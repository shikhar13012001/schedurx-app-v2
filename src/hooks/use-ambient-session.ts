"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { toast } from "sonner";
import { appendTranscriptSegment, isMeaningfulTranscript } from "@/lib/capture-session";
import { api, ApiError } from "@/lib/api-client";

// Biases Scribe's recognition toward terms it otherwise tends to mishear or
// drop — mostly medication names, which matter far more to get right in a
// clinical transcript than in general speech. ElevenLabs caps this at 100
// terms; keep additions targeted rather than exhaustive.
const CLINICAL_KEYTERMS = [
  "Paracetamol", "Ibuprofen", "Azithromycin", "Amoxicillin", "Ciprofloxacin",
  "Pantoprazole", "Omeprazole", "Metformin", "Amlodipine", "Losartan",
  "Atorvastatin", "Cetirizine", "Domperidone", "Ondansetron", "Ranitidine",
  "Levocetirizine", "Montelukast", "Salbutamol", "Dolo", "Crocin", "Combiflam",
  "ORS", "Digene",
];

// Below this, the transcript is almost certainly a false start — not a real
// consult worth turning into a note.
const MIN_TRANSCRIPT_CHARS = 12;

export type SessionPhase = "idle" | "starting" | "listening" | "stopping" | "review" | "saving" | "saved";

// A single microphone stream, opened once by Scribe, reused for both
// transcription and recording. An earlier version of this feature opened a
// *second*, independent getUserMedia stream to record alongside Scribe's
// own — on several mobile browsers that second concurrent mic request
// destabilized the first, breaking transcription entirely. RealtimeConnection
// keeps the MediaStreamTrack it captured on `_mediaStreamTrack` (an internal
// field, not part of the public API surface, but the only way to reach the
// same hardware capture without asking for it twice) — wrapping that single
// track in a MediaRecorder gets a saved recording for free, with zero risk
// of a second permission prompt or a second concurrent stream.
function getSharedMicStream(connection: unknown): MediaStream | null {
  const track = (connection as { _mediaStreamTrack?: MediaStreamTrack } | null)?._mediaStreamTrack;
  return track ? new MediaStream([track]) : null;
}

// The token is minted server-side (15-minute single-use) well before the
// mic button is ever tapped, so pull a fresh one every 10 minutes — a
// safety margin under the expiry, in case a doctor leaves the page open
// without capturing anything for a while.
const TOKEN_REFRESH_MS = 10 * 60 * 1000;

function micErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError") return "Microphone access was denied — check your browser's site permissions for ScheduRx.";
  if (name === "NotFoundError") return "No microphone was found on this device.";
  if (name === "NotReadableError") return "The microphone is already in use by another app or tab.";
  // Anything that doesn't match a known getUserMedia DOMException name is
  // something else entirely (a WebSocket/connect failure inside the SDK, a
  // network error, ...) — surfacing the real name/message here instead of
  // a generic "check permissions" is the only way to actually diagnose it
  // instead of guessing again next time this fires.
  const detail = name || (err instanceof Error ? err.message : typeof err === "string" ? err : null);
  return detail ? `Couldn't start listening — ${detail}` : "Couldn't start listening (unknown error).";
}

export interface AmbientSession {
  phase: SessionPhase;
  error: string | null;
  partialText: string;
  transcript: string;
  elapsedSec: number;
  hasRecording: boolean;
  start: () => Promise<void>;
  stop: () => void;
  resume: () => Promise<void>;
  discard: () => void;
  saveToNotes: (opts: { patientId: string; doctorId: string; appointmentId?: string; symptoms?: string; recommendation?: string | null }) => Promise<boolean>;
}

// Owns the full lifecycle: idle -> starting -> listening -> stopping ->
// review (Save / Resume / Discard) -> saving -> saved. "Stop" mutes rather
// than disconnects, and "Resume" unmutes rather than reconnects — the
// WebSocket connection and the microphone stay open for the whole session,
// which avoids the repeated connect/disconnect cycling that's a common
// source of "randomly stops listening" bugs in real-time voice SDKs.
export function useAmbientSession(): AmbientSession {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);

  const transcriptRef = useRef("");
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tells the page shell to ignore swipe-tab-navigation while a session is
  // open — this state is local to whichever component called this hook
  // (the Home page), so an accidental swipe away would otherwise unmount it
  // and silently drop the transcript/recording.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("srx-capture-active", { detail: phase !== "idle" }));
    return () => { window.dispatchEvent(new CustomEvent("srx-capture-active", { detail: false })); };
  }, [phase]);

  // A live session that errors out server-side (quota, rate limit, no
  // speech detected for too long, ...) leaves the WebSocket dead, but
  // without this the UI kept showing "Listening" indefinitely with only a
  // small error line underneath it — a session that's actually over
  // shouldn't still look like it's running. Moves straight to the review
  // state (Save/Resume/Discard) with the reason surfaced, same as a
  // manual Stop. Safe to call more than once for the same failure (the
  // SDK's generic onError also fires alongside every specific callback
  // below) — the phase check makes the second call a no-op.
  const handleSessionError = useCallback((message: string) => {
    setError(message);
    if (segmentStartRef.current) accumulatedMsRef.current += Date.now() - segmentStartRef.current;
    segmentStartRef.current = null;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (recorderRef.current?.state === "recording") recorderRef.current.pause();
    setPhase((p) => (p === "listening" ? "review" : p));
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    // VAD (not the default manual commit) is required for live mic input —
    // without it, committed transcripts never fire.
    commitStrategy: CommitStrategy.VAD,
    includeLanguageDetection: true,
    noVerbatim: true,
    keyterms: CLINICAL_KEYTERMS,
    onCommittedTranscript: (data: { text?: string }) => {
      if (!data.text?.trim()) return;
      transcriptRef.current = appendTranscriptSegment(transcriptRef.current, data.text);
      setTranscript(transcriptRef.current);
    },
    // Specific callbacks give a real, actionable reason instead of the
    // generic onError catch-all's bare "WebSocket error" — which is what a
    // real Scribe server-side close (e.g. no speech detected) looks like
    // through onError alone, with nothing to tell a doctor what actually
    // happened or that it wasn't a bug.
    onInsufficientAudioActivityError: () =>
      handleSessionError("No speech was detected, so the session ended. Tap Listen again and speak soon after starting."),
    onQuotaExceededError: () => handleSessionError("The transcription quota for this account has been used up."),
    onSessionTimeLimitExceededError: () => handleSessionError("This session reached its maximum length and ended automatically."),
    onRateLimitedError: () => handleSessionError("Too many requests right now — wait a moment and try again."),
    onAuthError: () => handleSessionError("The session's authorization expired — try starting again."),
    onError: (err) => handleSessionError(err instanceof Error ? err.message : "The listening connection hit an error."),
  });

  const startTimer = useCallback(() => {
    segmentStartRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const live = segmentStartRef.current ? Date.now() - segmentStartRef.current : 0;
      setElapsedSec(Math.floor((accumulatedMsRef.current + live) / 1000));
    }, 500);
  }, []);

  const pauseTimer = useCallback(() => {
    if (segmentStartRef.current) accumulatedMsRef.current += Date.now() - segmentStartRef.current;
    segmentStartRef.current = null;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  // Fetched ahead of time, not when the mic button is tapped. On iOS
  // Safari (and some other mobile browsers), calling getUserMedia() after
  // an awaited network round-trip inside the same click handler makes the
  // browser treat the user-gesture context as expired — the mic request
  // then fails as if permission was denied, even though nothing was ever
  // shown to deny. Scribe.connect() calls getUserMedia() internally, so the
  // token it needs has to already be in hand *before* start() runs, so
  // connect() begins in the same synchronous tick as the tap.
  const tokenRef = useRef<string | null>(null);
  const fetchToken = useCallback(async () => {
    try {
      const { token } = await api.get<{ token: string }>("/api/v1/visits/scribe-token");
      tokenRef.current = token;
    } catch {
      // Best-effort — start() falls back to fetching on demand if this
      // hasn't landed yet.
    }
  }, []);

  useEffect(() => {
    void fetchToken();
    const interval = setInterval(() => void fetchToken(), TOKEN_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchToken]);

  // A stable escape hatch for the unmount cleanup below — `scribe` itself
  // isn't referentially stable across renders, so an effect with `[]` deps
  // would otherwise close over a stale (and by unmount time, wrong)
  // reference to it.
  const scribeRef = useRef(scribe);
  scribeRef.current = scribe;

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      scribeRef.current.disconnect();
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    },
    []
  );

  // Best-effort, and silently so from the doctor's side — a missed
  // recording shouldn't interrupt a live consult over a bonus feature. But
  // silent doesn't mean untraceable: every path that gives up logs why, so
  // "the recording never attached" is diagnosable from the console instead
  // of a bare absence with no explanation (which is exactly what happened
  // here before this — no error, no attachment, no clue).
  const attachRecorder = useCallback(async () => {
    try {
      // _mediaStreamTrack is set as part of the same connect() call this
      // runs right after, but it's an internal field, not documented public
      // state — hedge against it landing a tick late with a few short
      // retries rather than trusting it's already there on the first read.
      let stream: MediaStream | null = null;
      for (let attempt = 0; attempt < 5 && !stream; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 100));
        stream = getSharedMicStream(scribe.getConnection());
      }
      if (!stream) {
        console.warn("[ambient-session] no shared mic stream available — recording will be skipped for this session (transcription is unaffected).");
        return;
      }
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onerror = (event) => console.error("[ambient-session] MediaRecorder error:", event);
      recorder.start();
      recorderRef.current = recorder;
      setHasRecording(true);
    } catch (err) {
      console.error("[ambient-session] attachRecorder failed:", err);
    }
  }, [scribe]);

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    transcriptRef.current = "";
    setTranscript("");
    audioChunksRef.current = [];
    accumulatedMsRef.current = 0;
    setHasRecording(false);
    scribe.clearTranscripts();
    // Token is (almost always) already sitting in tokenRef from the
    // background prefetch — using it here, with no await before connect(),
    // is what keeps getUserMedia() inside the same user-gesture tick as the
    // tap. Falling back to an on-demand fetch only covers the rare case of
    // tapping before the very first prefetch has landed.
    const token = tokenRef.current;
    tokenRef.current = null; // single-use — never reuse a consumed token
    try {
      const resolvedToken = token ?? (await api.get<{ token: string }>("/api/v1/visits/scribe-token")).token;
      await scribe.connect({
        token: resolvedToken,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Self-hosted so the SDK's AudioWorklet loads from this origin
          // instead of a blob:/data: URL — confirmed live: without this, a
          // strict script-src CSP (no blob:/data: allowed) blocks the
          // worklet entirely and the mic never actually starts streaming,
          // even once the WebSocket itself connects fine. Copied verbatim
          // from @elevenlabs/client/worklets/scribeAudioProcessor.js into
          // public/vendor/elevenlabs/.
          workletPaths: { scribeAudioProcessor: "/vendor/elevenlabs/scribe-audio-processor.js" },
        },
      });
      void attachRecorder(); // best-effort, backgrounded — never blocks the UI moving to "listening"
      startTimer();
      setPhase("listening");
      void fetchToken(); // line up the next one now, before it's needed
    } catch (err) {
      // A failed start unmounts the panel (phase idle) — the inline error
      // display goes with it, so this is the one place a toast is the only
      // way the doctor ever sees why. Without it, a failed start just
      // looked like the panel silently flickering open and closed.
      console.error("[ambient-session] start() failed:", err);
      const message = micErrorMessage(err);
      setError(message);
      toast.error(message);
      setPhase("idle");
      void fetchToken();
    }
  }, [scribe, attachRecorder, startTimer, fetchToken]);

  // Mute, not disconnect — the connection and the mic stream stay alive so
  // Resume is instant and never re-requests a token or the microphone.
  const stop = useCallback(() => {
    setPhase("stopping");
    pauseTimer();
    try { scribe.mute(); } catch { /* no-op if already unmuted/closed */ }
    if (recorderRef.current?.state === "recording") recorderRef.current.pause();
    setPhase("review");
  }, [scribe, pauseTimer]);

  const resume = useCallback(async () => {
    setError(null);
    try {
      scribe.unmute();
      if (recorderRef.current?.state === "paused") recorderRef.current.resume();
      startTimer();
      setPhase("listening");
    } catch (err) {
      setError(micErrorMessage(err));
      setPhase("review");
    }
  }, [scribe, startTimer]);

  const teardown = useCallback(() => {
    pauseTimer();
    scribe.disconnect();
    scribe.clearTranscripts();
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderRef.current = null;
  }, [scribe, pauseTimer]);

  const discard = useCallback(() => {
    teardown();
    transcriptRef.current = "";
    setTranscript("");
    audioChunksRef.current = [];
    accumulatedMsRef.current = 0;
    setElapsedSec(0);
    setHasRecording(false);
    setError(null);
    setPhase("idle");
  }, [teardown]);

  const stopRecorder = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: recorder?.mimeType || "audio/webm" }) : null);
        return;
      }
      recorder.onstop = () => resolve(audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null);
      recorder.stop();
    });

  const saveToNotes = useCallback(
    async (opts: { patientId: string; doctorId: string; appointmentId?: string; symptoms?: string; recommendation?: string | null }): Promise<boolean> => {
      const finalTranscript = transcriptRef.current.trim();
      if (!isMeaningfulTranscript(finalTranscript, MIN_TRANSCRIPT_CHARS)) {
        toast.message("Nothing worth saving", { description: "That recording was too short or quiet to turn into a note." });
        discard();
        return false;
      }
      setPhase("saving");
      try {
        const { visit } = await api.post<{ visit: { id: string } }>("/api/v1/visits", {
          patientId: opts.patientId, doctorId: opts.doctorId, appointmentId: opts.appointmentId, symptoms: opts.symptoms,
        });
        const clip = await stopRecorder();
        // The recommendation is kept out of the text handed to note
        // generation — that text becomes GPT input, and folding an
        // AI-authored suggestion into it risks the generated note
        // blending it in as if the doctor said it. Appended as a clearly
        // labeled addendum onto the finished note instead.
        const { visit: recapped } = await api.post<{ visit: { notes: string | null } }>(`/api/v1/visits/${visit.id}/recap`, { text: finalTranscript });
        if (opts.recommendation) {
          const notes = `${recapped.notes ?? ""}\n\nAI-suggested consideration during consult (not a diagnosis): ${opts.recommendation}`.trim();
          await api.patch(`/api/v1/visits/${visit.id}`, { notes });
        }
        if (clip) {
          try {
            const { path, uploadUrl } = await api.post<{ path: string; uploadUrl: string }>(`/api/v1/visits/${visit.id}/upload-url`, {
              fileName: "recording.webm", contentType: clip.type,
            });
            const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": clip.type }, body: clip });
            if (!putRes.ok) throw new Error(`Storage upload failed: ${putRes.status} ${putRes.statusText}`);
            await api.post(`/api/v1/visits/${visit.id}/attachments`, { path, type: "audio" });
          } catch (err) {
            // Best-effort — the note already saved either way, but this
            // failing silently is exactly why "no recording playback" was
            // undiagnosable before.
            console.error("[ambient-session] recording upload failed:", err);
          }
        } else {
          console.warn("[ambient-session] no recording clip to upload for this visit (attachRecorder likely never attached — see earlier warning).");
        }
        scribe.disconnect();
        recorderRef.current = null;
        setPhase("saved");
        setTimeout(() => setPhase((p) => (p === "saved" ? "idle" : p)), 1800);
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't save that recap.");
        setPhase("review");
        return false;
      }
    },
    [scribe, discard]
  );

  return { phase, error, partialText: scribe.partialTranscript, transcript, elapsedSec, hasRecording, start, stop, resume, discard, saveToNotes };
}
