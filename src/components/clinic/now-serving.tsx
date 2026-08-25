"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { ArrowLeft, ArrowRight, CalendarClock, ChevronLeft, ChevronRight, FileText, Lightbulb, Mic, Sparkles, UserRoundPlus, X } from "lucide-react";
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

export function NowServing({ doctorId, compact = false }: { doctorId: string; compact?: boolean }) {
  const { capturing, setCapturing, next, prev, settings, addTask } = useClinic();
  const { data: queue = [] } = useQueue();
  const { data: appointments = [] } = useAppointments({ date: toDateKey(new Date()) });
  const { data: patients } = usePatients();
  const role = useSession((s) => s.session?.role);
  const clinicId = useSession((s) => s.session?.clinicId);
  const [recapping, setRecapping] = useState(false);
  const [captureSettling, setCaptureSettling] = useState(false);
  const [fu, setFu] = useState<string | null>(null);
  const [encounterOpen, setEncounterOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const recorder = useVoiceRecorder();
  // Accumulated across the whole ambient-capture session — read at stop
  // time to build the final note, so a plain ref (not state) is enough;
  // nothing here needs to re-render on every committed segment.
  const transcriptRef = useRef("");
  const segmentsSinceSuggestRef = useRef(0);

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

  // Recap and ambient capture both end up here — record, stop, turn the
  // result into a structured note via POST /:visitId/recap. Recap sends
  // {audioBase64} (transcribed server-side via Whisper); real-time ambient
  // capture already has the transcript, so it sends {text} directly — the
  // route accepts either. Neither has a "current encounter" Visit row to
  // attach to yet (that only gets created after checkout elsewhere in the
  // app), so this creates one for today if the patient doesn't already
  // have one, then recaps onto it.
  const submitRecap = async (payload: { audioBase64: string; filename: string } | { text: string }) => {
    if (!patient) {
      toast.error("No patient file to save this to — this looks like a walk-in with no record yet.");
      return;
    }
    try {
      const today = toDateKey(new Date());
      let visitId = patient.visits.find((v) => v.date === today)?.id;
      if (!visitId) {
        const { visit } = await api.post<{ visit: { id: string } }>("/api/v1/visits", {
          patientId: patient.id, doctorId, appointmentId: appt?.id, symptoms: appt?.symptoms, visitDate: today,
        });
        visitId = visit.id;
      }
      const { visit: updated } = await api.post<{ visit: { notes: string | null } }>(`/api/v1/visits/${visitId}/recap`, payload);
      await queryClient.invalidateQueries({ queryKey: ["visits", clinicId, patient.id] });
      toast.success(`Recap saved to ${displayName?.split(" ")[0] ?? "patient"}'s file`, { description: updated.notes ?? undefined });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save that recap.");
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

  const setFollowUp = async (label: string, days: number) => {
    if (!patient && !current?.displayName) return;
    const d = new Date(); d.setDate(d.getDate() + days);
    setFu(label);
    try {
      await addTask(`Follow up with ${displayName ?? "patient"}`, d.toISOString());
      toast.success(`Follow-up set · ${fmtDate(d.toISOString())}`, { description: "Added to Tasks." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't set that follow-up.");
    }
  };

  // Ambient capture streams to ElevenLabs Scribe in real time (unlike the
  // "Recap" button above, which records one clip and transcribes it after
  // the fact) — this is what lets live suggestions surface mid-consult
  // instead of only once it's over.
  const toggleCapture = async () => {
    if (captureSettling) return;
    if (capturing) {
      setCapturing(false);
      setCaptureSettling(true);
      toast.message("Processing capture…");
      scribe.disconnect();
      const finalTranscript = transcriptRef.current.trim();
      transcriptRef.current = "";
      segmentsSinceSuggestRef.current = 0;
      setSuggestion(null);
      if (finalTranscript) await submitRecap({ text: finalTranscript });
      setCaptureSettling(false);
      toast.success("Visit context ready", { description: "Capture is paused and the clinical context is up to date." });
      return;
    }
    try {
      const { token } = await api.get<{ token: string }>("/api/v1/visits/scribe-token");
      await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      setCapturing(true);
      toast.success("Listening", { description: "With patient consent. Tap again anytime to pause." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't start listening — check your microphone permissions.");
    }
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
                <button onClick={() => void prev(doctorId)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.12] text-white" aria-label="Previous patient"><ChevronLeft size={20} /></button>
                {role === "doctor" ? (
                  settings.captureMode === "ambient" ? (
                    <button onClick={toggleCapture} className="pressable" disabled={captureSettling} aria-label={captureSettling ? "Processing ambient capture" : capturing ? "Pause ambient capture" : "Start ambient capture"}><AIControl size={62} state={captureSettling ? "thinking" : capturing ? "live" : "idle"} icon={false} /></button>
                  ) : (
                    <button onClick={doRecap} className={cn("pressable flex h-12 items-center gap-2 rounded-pill px-5 text-[13px] font-medium", recapping ? "bg-danger text-white" : "bg-white text-ink")}><Mic size={16} /> {recapping ? "Tap to finish" : "Recap"}</button>
                  )
                ) : <span className="text-[12px] text-white/[0.56]">{active.length} in queue</span>}
                <button onClick={() => void next(doctorId)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary text-charcoal" aria-label="Next patient"><ChevronRight size={20} /></button>
              </div>
            )}

            <div className={cn("mt-4 flex items-center justify-between text-[11.5px]", compact ? "text-faint" : "text-white/[0.54]")}>
              <span>{isNew ? "New patient · file starts today" : `Last seen ${fmtDate(lastVisit?.date ?? new Date().toISOString())}`}</span>
              {upNextName && <span className="truncate pl-3">Next · {upNextName}</span>}
            </div>
          </motion.div>
        </AnimatePresence>

        {role === "doctor" && !compact && (
          <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4" data-noswipe>
            <Sparkles size={14} className="shrink-0 text-primary" />
            <span className="mr-1 text-[12px] text-white/[0.58]">Follow-up</span>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {[["1 wk", 7], ["2 wks", 14], ["1 mo", 30], ["3 mos", 90]].map(([label, days]) => (
                <button key={label as string} onClick={() => setFollowUp(label as string, days as number)} className={cn("pressable shrink-0 rounded-pill px-3 py-1.5 text-[11.5px]", fu === label ? "bg-primary text-charcoal" : "bg-white/10 text-charcoal/[0.68]")}>{label}</button>
              ))}
            </div>
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

              <div className="relative mt-12 flex items-center gap-4">
                <Avatar id={patient?.id ?? current.id} name={displayName ?? "Guest"} size={70} ring />
                <div className="min-w-0">
                  <p className="text-[12px] text-white/[0.48]">Current patient</p>
                  <h2 className="mt-1 truncate font-display text-[48px] font-light leading-[.92] tracking-[-0.06em] sm:text-[58px]">{displayName ?? "Guest"}</h2>
                  <p className="mt-2 text-[13px] text-white/[0.58]">{patient ? `${patient.age} yrs · ${patient.gender === "M" ? "Male" : "Female"}` : "Walk-in"}{appt ? ` · ${fmtTime(appt.startsAt)}` : ""}</p>
                </div>
              </div>

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

                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  <button onClick={toggleCapture} disabled={captureSettling} aria-label={captureSettling ? "Processing ambient capture" : capturing ? "Pause ambient capture" : "Start ambient capture"} className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card disabled:opacity-[0.72]">
                    <AIControl size={62} state={captureSettling ? "thinking" : capturing ? "live" : "idle"} icon={false} />
                    <span><span className="block text-[13px] text-black/[0.48]">Ambient capture</span><span className="mt-1 block text-[18px] font-medium">{captureSettling ? "Processing" : capturing ? "Listening" : "Start capture"}</span></span>
                  </button>
                  {patient && (
                    <Link href={`/patients/${patient.id}`} className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card">
                      <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white"><FileText size={21} /></span>
                      <span><span className="block text-[13px] text-black/[0.48]">Patient record</span><span className="mt-1 block text-[18px] font-medium">Open history</span></span>
                    </Link>
                  )}
                </div>
              </div>

              <div className="relative mt-4 flex items-center justify-between rounded-[30px] bg-white/[0.08] px-3 py-3 backdrop-blur-xl">
                <button onClick={() => void prev(doctorId)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-white/10" aria-label="Previous patient"><ChevronLeft size={20} /></button>
                <span className="text-center text-[12px] text-white/[0.52]">{captureSettling ? "Turning speech into context" : capturing ? "Capturing this consult" : "Ready when you are"}</span>
                <button onClick={() => void next(doctorId)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary" aria-label="Next patient"><ChevronRight size={20} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
