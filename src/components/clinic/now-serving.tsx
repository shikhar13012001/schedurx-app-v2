"use client";
import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { ArrowLeft, ArrowRight, Calendar, CalendarClock, Camera, ChevronLeft, ChevronRight, FileText, Lightbulb, Mic, Sparkles, Square, UserRoundPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AIControl } from "@/components/ui/ai-control";
import { useClinic, useSession } from "@/stores";
import { useQueue, activeQueue } from "@/hooks/use-queue";
import { useAppointments } from "@/hooks/use-appointments";
import { usePatients } from "@/hooks/use-patients";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { api, ApiError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { cn, fmtDate, fmtTime, toDateKey } from "@/lib/utils";

// How many committed transcript segments accumulate before asking for a new
// live suggestion — not on every segment (that's chatty and mostly
// redundant turn-by-turn), not only at the end (too late to be useful).
const SUGGEST_EVERY_N_SEGMENTS = 3;

// Below this, the transcript is almost certainly a false start (mic toggled
// on/off quickly, or a stray word or two) — submitting it produces the GPT
// note-generation prompt's honest-but-useless "the doctor provided no
// information to summarize" reply, which is worse than no note at all.
const MIN_TRANSCRIPT_CHARS = 12;

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

type CaptureState = "idle" | "capturing" | "paused";

// Walk-ins with no patient record have nowhere to link — renders as a plain,
// non-interactive wrapper for them instead of a dead/empty href.
function PatientLink({ patientId, className, children }: { patientId?: string; className?: string; children: ReactNode }) {
  if (!patientId) return <div className={className}>{children}</div>;
  return <Link href={`/patients/${patientId}`} className={className}>{children}</Link>;
}

export function NowServing({ doctorId, compact = false }: { doctorId: string; compact?: boolean }) {
  const { next, prev, settings, addTask } = useClinic();
  const { data: queue = [] } = useQueue();
  const { data: appointments = [] } = useAppointments({ date: toDateKey(new Date()) });
  const { data: patients } = usePatients();
  const role = useSession((s) => s.session?.role);
  const clinicId = useSession((s) => s.session?.clinicId);
  const [recapping, setRecapping] = useState(false);
  // Local to this component — nothing else in the app reads ambient-capture
  // state, so this no longer lives in the global store (it used to, as a
  // plain boolean; a three-state session needs more than that anyway).
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [captureSettling, setCaptureSettling] = useState(false);
  const [fu, setFu] = useState<string | null>(null);
  const [customFollowUpOpen, setCustomFollowUpOpen] = useState(false);
  const [encounterOpen, setEncounterOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const recorder = useVoiceRecorder();
  const rxFileRef = useRef<HTMLInputElement>(null);
  // Accumulated across the whole ambient-capture session, including across
  // a pause/resume — read at End time to build the final note, so a plain
  // ref (not state) is enough; nothing here needs to re-render on every
  // committed segment.
  const transcriptRef = useRef("");
  const segmentsSinceSuggestRef = useRef(0);
  // Scribe streams mic audio straight to ElevenLabs — our server never sees
  // the raw bytes, so nothing's available to play back later unless we
  // separately record it ourselves. A second independent getUserMedia
  // stream (browsers allow more than one consumer of the same mic) feeds a
  // plain MediaRecorder alongside Scribe's own connection, paused/resumed
  // in lockstep with the capture session.
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchSuggestion = async () => {
    const transcript = transcriptRef.current.trim();
    if (!transcript) return;
    try {
      const { suggestion: fresh } = await api.post<{ suggestion: string | null }>("/api/v1/visits/suggest", { transcript });
      if (fresh) setSuggestion(fresh);
    } catch {
      // Best-effort — a failed suggestion call is silent, never interrupts the consult.
    }
  };

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    // VAD (not the default manual commit) is required for live mic input —
    // without it, committed transcripts never fire (see the ElevenLabs
    // speech-to-text skill's own warning on this).
    commitStrategy: CommitStrategy.VAD,
    // Auto-detects the spoken language per session (Hindi, English, and
    // Scribe's other 90+ supported languages all work here) — no fixed
    // languageCode hint, so a clinic isn't locked to one language. A
    // secondary-languages hint for mid-sentence code-switching (common in
    // Indian clinics) is part of ElevenLabs' realtime protocol but isn't
    // yet exposed by the installed @elevenlabs/react@1.14.0's useScribe
    // typings — worth adding once it lands in a client release.
    includeLanguageDetection: true,
    // Strips filler words/false starts/disfluencies — the transcript feeds
    // straight into a clinical note, not a verbatim court transcript.
    noVerbatim: true,
    keyterms: CLINICAL_KEYTERMS,
    onCommittedTranscript: (data: { text?: string }) => {
      if (!data.text) return;
      transcriptRef.current = transcriptRef.current ? `${transcriptRef.current} ${data.text}` : data.text;
      segmentsSinceSuggestRef.current += 1;
      if (segmentsSinceSuggestRef.current >= SUGGEST_EVERY_N_SEGMENTS) {
        segmentsSinceSuggestRef.current = 0;
        void fetchSuggestion();
      }
    },
  });

  const active = useMemo(() => activeQueue(queue).filter((q) => q.doctorId === doctorId), [queue, doctorId]);
  const current = active.find((q) => q.state === "in_room") ?? active[0];
  const patient = current ? patients?.find((p) => p.id === current.patientId) : undefined;
  const displayName = patient?.name ?? current?.displayName;
  const appt = current?.apptId ? appointments.find((a) => a.id === current.apptId) : undefined;
  const upNext = active.filter((q) => q.id !== current?.id)[0];
  const upNextName = upNext ? (patients?.find((p) => p.id === upNext.patientId)?.name ?? upNext.displayName) : undefined;

  if (!current || (!patient && !current.displayName)) {
    // Nobody's physically checked in, but there may still be bookings later
    // today — say so instead of implying the day is empty.
    const nextAppt = appointments
      .filter((a) => a.doctorId === doctorId && ["confirmed", "tentative"].includes(a.status) && +new Date(a.startsAt) > Date.now())
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
    const nextPatientName = nextAppt ? patients?.find((p) => p.id === nextAppt.patientId)?.name : undefined;

    return (
      <div className="rounded-panel bg-surface-2/70 px-6 py-9">
        <p className="font-display text-[28px] font-light leading-none">{nextAppt ? "Nobody's checked in yet." : "Queue is clear."}</p>
        <p className="mt-2 max-w-[320px] text-[14px] leading-relaxed text-muted">
          {nextAppt ? "They'll appear here as soon as front desk checks them in." : "Walk-ins and arrivals will appear here as soon as front desk checks them in."}
        </p>
        {nextAppt && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-pill bg-surface px-4 py-2.5 text-[12.5px] text-ink shadow-card">
            <CalendarClock size={13} className="text-primary" />
            Next · {nextPatientName ?? "Patient"} at {fmtTime(nextAppt.startsAt)}
          </p>
        )}
      </div>
    );
  }

  const lastVisit = patient?.visits[0];
  const isNew = !patient?.visits.length;

  // The backend resolves the same (clinicId, patientId, today) Visit row
  // every time — safe to call as often as needed without ever creating a
  // duplicate, so this doesn't try to guess client-side whether one
  // already exists (patient.visits here is a list-view row and never
  // carries the full visits array, so that guess would always be wrong).
  const ensureVisitId = async (patientId: string): Promise<string> => {
    const { visit } = await api.post<{ visit: { id: string } }>("/api/v1/visits", {
      patientId, doctorId, appointmentId: appt?.id, symptoms: appt?.symptoms, visitDate: toDateKey(new Date()),
    });
    return visit.id;
  };

  // Every view that shows this patient's data reads from a different query
  // key — the patients list (visitsCount/lastVisitDate), this patient's own
  // detail page, and their visit history. Without invalidating all three,
  // whichever of those isn't the one currently on screen stays stale until
  // a manual reload, even though the recap/attachment/recording really did
  // save.
  const invalidatePatientData = async (patientId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["visits", clinicId, patientId] }),
      queryClient.invalidateQueries({ queryKey: ["patient", clinicId, patientId] }),
      queryClient.invalidateQueries({ queryKey: ["patients", clinicId] }),
    ]);
  };

  // Recap and ambient capture both end up here — record, stop, turn the
  // result into a structured note via POST /:visitId/recap. Recap sends
  // {audioBase64} (transcribed server-side via Whisper); real-time ambient
  // capture already has the transcript, so it sends {text} directly — the
  // route accepts either.
  const submitRecap = async (payload: { audioBase64: string; filename: string } | { text: string }) => {
    if (!patient) {
      toast.error("No patient file to save this to — this looks like a walk-in with no record yet.");
      return;
    }
    try {
      const visitId = await ensureVisitId(patient.id);
      const { visit: updated } = await api.post<{ visit: { notes: string | null } }>(`/api/v1/visits/${visitId}/recap`, payload);
      await invalidatePatientData(patient.id);
      toast.success(`Recap saved to ${displayName?.split(" ")[0] ?? "patient"}'s file`, { description: updated.notes ?? undefined });
      return visitId;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save that recap.");
      return undefined;
    }
  };

  const doRecap = async () => {
    if (recorder.recording) {
      setRecapping(false);
      const clip = await recorder.stop();
      if (clip) await submitRecap({ audioBase64: clip.base64, filename: clip.filename });
      return;
    }
    try {
      await recorder.start();
      setRecapping(true);
    } catch {
      toast.error("Couldn't access the microphone — check your browser permissions.");
    }
  };

  const setFollowUp = async (label: string, dueDate: Date) => {
    if (!patient && !current?.displayName) return;
    setFu(label);
    setCustomFollowUpOpen(false);
    try {
      await addTask(`Follow up with ${displayName ?? "patient"}`, dueDate.toISOString());
      toast.success(`Follow-up set · ${fmtDate(dueDate.toISOString())}`, { description: "Added to Tasks." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't set that follow-up.");
    }
  };
  const setFollowUpDays = (label: string, days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    void setFollowUp(label, d);
  };
  const setFollowUpCustom = (dateStr: string) => {
    if (!dateStr) return;
    // Local midnight on the picked date, not UTC — a date <input> value has
    // no time-of-day of its own, and parsing it as UTC can land it on the
    // wrong calendar day for anyone east of Greenwich.
    const [y, m, d] = dateStr.split("-").map(Number);
    void setFollowUp(fmtDate(new Date(y, m - 1, d).toISOString()), new Date(y, m - 1, d));
  };

  const attachPrescriptionPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!patient) {
      toast.error("No patient file to attach this to — this looks like a walk-in with no record yet.");
      return;
    }
    try {
      const visitId = await ensureVisitId(patient.id);
      const { path, uploadUrl } = await api.post<{ path: string; uploadUrl: string }>(`/api/v1/visits/${visitId}/upload-url`, {
        fileName: file.name, contentType: file.type,
      });
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      await api.post(`/api/v1/visits/${visitId}/attachments`, { path, type: "photo" });
      await invalidatePatientData(patient.id);
      toast.success("Prescription attached", { description: "Saved to the visit and ready to share with the patient." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't attach that file — try again.");
    }
  };

  // Ambient capture streams to ElevenLabs Scribe in real time (unlike the
  // "Recap" button above, which records one clip and transcribes it after
  // the fact) — this is what lets live suggestions surface mid-consult
  // instead of only once it's over. Three states, not a toggle: capturing
  // and paused are both "a session is open" — only End actually finalizes
  // and submits the recap. Next/prev (below) always End first if a session
  // is still open, so it can never keep listening into the wrong patient.
  // Best-effort, separate from the Scribe connection itself — if the second
  // getUserMedia call fails (or MediaRecorder isn't supported), ambient
  // capture still works exactly as before, just without a saved recording.
  const startAudioRecording = () => {
    audioChunksRef.current = [];
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        audioStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
        recorder.start();
        audioRecorderRef.current = recorder;
      })
      .catch(() => {
        // Silent — the transcript/note still saves fine without a recording.
      });
  };

  const stopAudioRecording = (): Promise<{ blob: Blob; filename: string } | null> =>
    new Promise((resolve) => {
      const recorder = audioRecorderRef.current;
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      audioRecorderRef.current = null;
      if (!recorder || recorder.state === "inactive") {
        resolve(audioChunksRef.current.length ? { blob: new Blob(audioChunksRef.current, { type: recorder?.mimeType || "audio/webm" }), filename: "recording.webm" } : null);
        return;
      }
      recorder.onstop = () => {
        if (!audioChunksRef.current.length) { resolve(null); return; }
        const mime = recorder.mimeType || "audio/webm";
        resolve({ blob: new Blob(audioChunksRef.current, { type: mime }), filename: mime.includes("mp4") ? "recording.mp4" : "recording.webm" });
      };
      recorder.stop();
    });

  const startCapture = async () => {
    try {
      const { token } = await api.get<{ token: string }>("/api/v1/visits/scribe-token");
      await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      setCaptureState("capturing");
      startAudioRecording();
      toast.success("Listening", { description: "With patient consent. Pause or end anytime." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't start listening — check your microphone permissions.");
    }
  };

  const pauseCapture = () => {
    scribe.disconnect();
    if (audioRecorderRef.current?.state === "recording") audioRecorderRef.current.pause();
    setCaptureState("paused");
    toast.message("Paused", { description: "Nothing's being saved yet — resume or end whenever you're ready." });
  };

  const resumeCapture = async () => {
    try {
      const { token } = await api.get<{ token: string }>("/api/v1/visits/scribe-token");
      await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      setCaptureState("capturing");
      if (audioRecorderRef.current?.state === "paused") audioRecorderRef.current.resume();
      else if (!audioRecorderRef.current) startAudioRecording();
      toast.success("Listening again");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't resume — check your microphone permissions.");
    }
  };

  // Uploads the session's recording onto the visit that was just created/
  // updated by submitRecap — reuses the same upload-url + attachments flow
  // as the prescription-photo attach, just tagged "audio". Best-effort: a
  // failure here never undoes the recap that already saved.
  const uploadCaptureRecording = async (visitId: string, clip: { blob: Blob; filename: string }) => {
    try {
      const { path, uploadUrl } = await api.post<{ path: string; uploadUrl: string }>(`/api/v1/visits/${visitId}/upload-url`, {
        fileName: clip.filename, contentType: clip.blob.type,
      });
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": clip.blob.type }, body: clip.blob });
      await api.post(`/api/v1/visits/${visitId}/attachments`, { path, type: "audio" });
      if (patient) await invalidatePatientData(patient.id);
    } catch {
      // Best-effort — the transcript-based note already saved either way.
    }
  };

  const endCapture = async () => {
    if (captureState === "idle") return;
    if (captureState === "capturing") scribe.disconnect();
    setCaptureState("idle");
    setCaptureSettling(true);
    const finalTranscript = transcriptRef.current.trim();
    transcriptRef.current = "";
    segmentsSinceSuggestRef.current = 0;
    setSuggestion(null);
    const clip = await stopAudioRecording();
    if (finalTranscript.length >= MIN_TRANSCRIPT_CHARS) {
      toast.message("Processing capture…");
      const visitId = await submitRecap({ text: finalTranscript });
      if (visitId && clip) await uploadCaptureRecording(visitId, clip);
      toast.success("Visit context ready", { description: "The clinical note is up to date." });
    }
    setCaptureSettling(false);
  };

  // A session left open (capturing or paused) must never silently follow
  // the queue to a different patient — end it first, always.
  const goNext = async () => {
    await endCapture();
    await next(doctorId);
  };
  const goPrev = async () => {
    await endCapture();
    await prev(doctorId);
  };

  return (
    <>
      <section className={cn("relative overflow-hidden rounded-panel shadow-card", compact ? "bg-surface" : "atmosphere atmosphere-dark text-white")} data-noswipe>
        <div className={cn("flex items-center justify-between px-5 pt-5", compact ? "text-ink" : "text-white")}>
          <span className={cn("flex items-center gap-2 text-[12px]", compact ? "text-muted" : "text-white/[0.64]")}>
            <span className={cn("h-2 w-2 rounded-full", compact ? "bg-primary" : "bg-[#EC6B25]")} /> Now serving
          </span>
          {appt && <span className={cn("flex items-center gap-1.5 text-[12px] tnum", compact ? "text-muted" : "text-white/[0.64]")}><CalendarClock size={13} /> {fmtTime(appt.startsAt)}</span>}
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={current.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="px-5 pb-5 pt-4">
            <div className="flex items-start gap-3.5">
              {/* Tapping the person (not the arrow, which does something
                  else — open encounter / go to profile depending on role)
                  always goes straight to their patient file. */}
              <PatientLink patientId={patient?.id} className="flex min-w-0 flex-1 items-start gap-3.5">
                <Avatar id={patient?.id ?? current.id} name={displayName ?? "Guest"} size={compact ? 48 : 58} ring={!compact} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={cn("truncate font-display font-light leading-none tracking-[-0.05em]", compact ? "text-[25px] text-ink" : "text-[31px] text-white")}>{displayName ?? "Guest"}</h3>
                    {appt?.critical && <Badge tone="danger">Critical</Badge>}
                  </div>
                  {patient && (
                    <p className={cn("mt-1 text-[12.5px]", compact ? "text-muted" : "text-white/[0.62]")}>{patient.age} yrs · {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "—"}{patient.tags.length ? ` · ${patient.tags.join(" · ")}` : ""}</p>
                  )}
                  {current.walkIn && <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-primary-ink"><UserRoundPlus size={12} /> Walk-in</p>}
                </div>
              </PatientLink>
              {role === "doctor" ? (
                <button onClick={() => setEncounterOpen(true)} className={cn("pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full", compact ? "bg-surface-2 text-ink" : "bg-white text-ink")} aria-label="Open encounter">
                  <ArrowRight size={19} />
                </button>
              ) : patient ? (
                <Link href={`/patients/${patient.id}`} className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-label={`Open ${displayName}'s patient file`}>
                  <ArrowRight size={19} />
                </Link>
              ) : null}
            </div>

            {appt?.symptoms && (
              <div className={cn("mt-5 rounded-[26px] px-4 py-4", compact ? "bg-surface-2/75" : "bg-white/10 backdrop-blur-md") }>
                <p className={cn("text-[11px]", compact ? "text-faint" : "text-white/[0.48]")}>Reason for visit</p>
                <p className={cn("mt-1 text-[14.5px] leading-snug", compact ? "text-ink" : "text-white/[0.92]")}>{appt.symptoms}</p>
              </div>
            )}

            {!compact && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <button onClick={() => void goPrev()} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.12] text-white" aria-label="Previous patient"><ChevronLeft size={20} /></button>
                {role === "doctor" ? (
                  settings.captureMode === "ambient" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (captureState === "idle") void startCapture(); else if (captureState === "capturing") pauseCapture(); else void resumeCapture(); }}
                        className="pressable"
                        disabled={captureSettling}
                        aria-label={captureSettling ? "Processing ambient capture" : captureState === "capturing" ? "Pause ambient capture" : captureState === "paused" ? "Resume ambient capture" : "Start ambient capture"}
                      >
                        <AIControl size={62} state={captureSettling ? "thinking" : captureState === "capturing" ? "live" : "idle"} icon={false} />
                      </button>
                      {captureState !== "idle" && (
                        <button onClick={() => void endCapture()} disabled={captureSettling} className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white disabled:opacity-60" aria-label="End session">
                          <Square size={13} fill="currentColor" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={doRecap} className={cn("pressable flex h-12 items-center gap-2 rounded-pill px-5 text-[13px] font-medium", recapping ? "bg-danger text-white" : "bg-white text-ink")}><Mic size={16} /> {recapping ? "Tap to finish" : "Recap"}</button>
                  )
                ) : <span className="text-[12px] text-white/[0.56]">{active.length} in queue</span>}
                <button onClick={() => void goNext()} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary text-charcoal" aria-label="Next patient"><ChevronRight size={20} /></button>
              </div>
            )}

            <div className={cn("mt-4 flex items-center justify-between text-[11.5px]", compact ? "text-faint" : "text-white/[0.54]")}>
              <span>{isNew ? "New patient · file starts today" : `Last seen ${fmtDate(lastVisit?.date ?? new Date().toISOString())}`}</span>
              {upNextName && <span className="truncate pl-3">Next · {upNextName}</span>}
            </div>
          </motion.div>
        </AnimatePresence>

        {role === "doctor" && !compact && (
          <div className="border-t border-white/10 px-5 py-4" data-noswipe>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="shrink-0 text-primary" />
              <span className="mr-1 text-[12px] text-white/[0.58]">Follow-up</span>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {[["1 wk", 7], ["2 wks", 14], ["1 mo", 30], ["3 mos", 90]].map(([label, days]) => (
                  <button key={label as string} onClick={() => setFollowUpDays(label as string, days as number)} className={cn("pressable shrink-0 rounded-pill px-3 py-1.5 text-[11.5px]", fu === label ? "bg-primary text-charcoal" : "bg-white/10 text-charcoal/[0.68]")}>{label}</button>
                ))}
                <button onClick={() => setCustomFollowUpOpen((o) => !o)} className={cn("pressable flex shrink-0 items-center gap-1 rounded-pill px-3 py-1.5 text-[11.5px]", customFollowUpOpen ? "bg-primary text-charcoal" : "bg-white/10 text-charcoal/[0.68]")}>
                  <Calendar size={11} /> Custom
                </button>
              </div>
            </div>
            {customFollowUpOpen && (
              <input
                type="date"
                min={toDateKey(new Date())}
                onChange={(event) => setFollowUpCustom(event.target.value)}
                className="mt-2.5 h-10 w-full rounded-pill bg-white/10 px-4 text-[12.5px] text-white [color-scheme:dark]"
                aria-label="Custom follow-up date"
              />
            )}
          </div>
        )}
      </section>

      <AnimatePresence>
        {encounterOpen && role === "doctor" && (
          <motion.div className="fixed inset-0 z-[80] overflow-y-auto bg-[#181818] text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-noswipe>
            <div className="relative mx-auto flex min-h-dvh max-w-[760px] flex-col overflow-hidden px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))] md:px-8">
              <div className="pointer-events-none absolute -right-24 top-[12%] h-[420px] w-[420px] rounded-full bg-primary/50 blur-[110px]" />
              <div className="flex items-center justify-between">
                <button onClick={() => setEncounterOpen(false)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink" aria-label="Close encounter"><ArrowLeft size={19} /></button>
                <span className="srx-dark-glass rounded-pill px-4 py-2 text-[12px] text-white/70">● Live encounter</span>
              </div>

              <PatientLink patientId={patient?.id} className="relative mt-12 flex items-center gap-4">
                <Avatar id={patient?.id ?? current.id} name={displayName ?? "Guest"} size={70} ring />
                <div className="min-w-0">
                  <p className="text-[12px] text-white/[0.48]">Current patient</p>
                  <h2 className="mt-1 truncate font-display text-[48px] font-light leading-[.92] tracking-[-0.06em] sm:text-[58px]">{displayName ?? "Guest"}</h2>
                  <p className="mt-2 text-[13px] text-white/[0.58]">{patient ? `${patient.age} yrs · ${patient.gender === "M" ? "Male" : "Female"}` : "Walk-in"}{appt ? ` · ${fmtTime(appt.startsAt)}` : ""}</p>
                </div>
              </PatientLink>

              <div className="relative mt-10 flex-1 rounded-[40px] bg-[#B9B6B1] p-5 text-[#181818] md:p-7">
                <p className="text-[12px] text-black/[0.48]">Clinical context</p>
                <p className="mt-3 max-w-[560px] font-display text-[31px] font-light leading-[1.05] tracking-[-0.045em]">{appt?.symptoms ?? "Open consultation"}</p>
                {lastVisit && <p className="mt-5 max-w-[580px] text-[14px] leading-relaxed text-black/[0.62]"><span className="font-medium text-black/80">Last visit · {fmtDate(lastVisit.date)}</span><br />{lastVisit.note}</p>}

                {/* Doctor-facing only, grounded only in what's actually been
                    said so far — a prompt for the doctor's own judgment,
                    never a diagnosis. See openai-service.js's
                    suggestDuringConsult for the full framing. */}
                {suggestion && (
                  <div className="mt-5 flex max-w-[580px] items-start gap-3 rounded-[24px] bg-primary/[0.14] px-4 py-3.5">
                    <Lightbulb size={15} className="mt-0.5 shrink-0 text-primary-ink" />
                    <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-black/80">{suggestion}</p>
                    <button onClick={() => setSuggestion(null)} className="shrink-0 text-black/40" aria-label="Dismiss suggestion"><X size={15} /></button>
                  </div>
                )}

                <input ref={rxFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={attachPrescriptionPhoto} />

                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => { if (captureState === "idle") void startCapture(); else if (captureState === "capturing") pauseCapture(); else void resumeCapture(); }}
                    disabled={captureSettling}
                    aria-label={captureSettling ? "Processing ambient capture" : captureState === "capturing" ? "Pause ambient capture" : captureState === "paused" ? "Resume ambient capture" : "Start ambient capture"}
                    className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card disabled:opacity-[0.72]"
                  >
                    <AIControl size={62} state={captureSettling ? "thinking" : captureState === "capturing" ? "live" : "idle"} icon={false} />
                    <span>
                      <span className="block text-[13px] text-black/[0.48]">Ambient capture</span>
                      <span className="mt-1 block text-[18px] font-medium">
                        {captureSettling ? "Processing" : captureState === "capturing" ? "Listening" : captureState === "paused" ? "Paused — tap to resume" : "Start capture"}
                      </span>
                    </span>
                  </button>
                  {captureState !== "idle" ? (
                    <button onClick={() => void endCapture()} disabled={captureSettling} className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card disabled:opacity-[0.72]">
                      <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-danger text-white"><Square size={20} fill="currentColor" /></span>
                      <span><span className="block text-[13px] text-black/[0.48]">Session</span><span className="mt-1 block text-[18px] font-medium">End &amp; save note</span></span>
                    </button>
                  ) : (
                    <button onClick={() => rxFileRef.current?.click()} className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card">
                      <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white"><Camera size={21} /></span>
                      <span><span className="block text-[13px] text-black/[0.48]">Prescription</span><span className="mt-1 block text-[18px] font-medium">Attach a photo</span></span>
                    </button>
                  )}
                  {patient && (
                    <Link href={`/patients/${patient.id}`} className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card">
                      <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white"><FileText size={21} /></span>
                      <span><span className="block text-[13px] text-black/[0.48]">Patient record</span><span className="mt-1 block text-[18px] font-medium">Open history</span></span>
                    </Link>
                  )}
                  {captureState !== "idle" && (
                    <button onClick={() => rxFileRef.current?.click()} className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card">
                      <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white"><Camera size={21} /></span>
                      <span><span className="block text-[13px] text-black/[0.48]">Prescription</span><span className="mt-1 block text-[18px] font-medium">Attach a photo</span></span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative mt-4 flex items-center justify-between rounded-[30px] bg-white/[0.08] px-3 py-3 backdrop-blur-xl">
                <button onClick={() => void goPrev()} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-white/10" aria-label="Previous patient"><ChevronLeft size={20} /></button>
                <span className="text-center text-[12px] text-white/[0.52]">
                  {captureSettling ? "Turning speech into context" : captureState === "capturing" ? "Capturing this consult" : captureState === "paused" ? "Capture paused" : "Ready when you are"}
                </span>
                <button onClick={() => void goNext()} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary" aria-label="Next patient"><ChevronRight size={20} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
