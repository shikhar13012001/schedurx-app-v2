"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar, CalendarClock, Camera, ChevronLeft, ChevronRight, FileText, Mic, Sparkles, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useClinic, useSession } from "@/stores";
import { useAppointments } from "@/hooks/use-appointments";
import { useCurrentPatient } from "@/hooks/use-current-patient";
import { usePatients } from "@/hooks/use-patients";
import { api, ApiError } from "@/lib/api-client";
import type { CaptureTarget } from "@/lib/capture-session";
import { queryClient } from "@/lib/query-client";
import { cn, fmtDate, fmtTime, toDateKey } from "@/lib/utils";

// Walk-ins with no patient record have nowhere to link — renders as a plain,
// non-interactive wrapper for them instead of a dead/empty href.
function PatientLink({ patientId, className, children }: { patientId?: string; className?: string; children: ReactNode }) {
  if (!patientId) return <div className={className}>{children}</div>;
  return <Link href={`/patients/${patientId}`} className={className}>{children}</Link>;
}

// Ambient capture itself (mic -> live transcript -> recommendations -> save)
// lives in AmbientCaptureController/AmbientListenerPanel at the Home page
// level now, not here — this card's mic button is only the entry point. It
// signals via a window event rather than a prop callback because the
// listener panel is dynamically imported and isn't a sibling of this
// component in the render tree; dispatching the target patient as the
// event's detail means the listening UI survives regardless of which
// patient this card ends up showing next, or whether the doctor taps
// Next/Prev while a session is open.
function startCapture(target: CaptureTarget) {
  window.dispatchEvent(new CustomEvent<CaptureTarget>("srx-start-capture", { detail: target }));
}

export function NowServing({ doctorId, compact = false }: { doctorId: string; compact?: boolean }) {
  const { next, prev, addTask } = useClinic();
  const { data: appointments = [] } = useAppointments({ date: toDateKey(new Date()) });
  const role = useSession((s) => s.session?.role);
  const clinicId = useSession((s) => s.session?.clinicId);
  const [fu, setFu] = useState<string | null>(null);
  const [customFollowUpOpen, setCustomFollowUpOpen] = useState(false);
  const [encounterOpen, setEncounterOpen] = useState(false);
  const rxFileRef = useRef<HTMLInputElement>(null);

  const { data: patients } = usePatients();
  const { active, current, patient, appt, displayName } = useCurrentPatient(doctorId);
  const upNext = active.filter((q) => q.id !== current?.id)[0];
  const upNextName = upNext ? (patients?.find((p) => p.id === upNext.patientId)?.name ?? upNext.displayName) : undefined;

  if (!current || (!patient && !current.displayName)) {
    // Nobody's physically checked in, but there may still be bookings later
    // today — say so instead of implying the day is empty.
    const nextAppt = appointments
      .filter((a) => a.doctorId === doctorId && ["confirmed", "tentative"].includes(a.status) && +new Date(a.startsAt) > Date.now())
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];

    return (
      <div className="rounded-panel bg-surface-2/70 px-6 py-9">
        <p className="font-display text-[28px] font-light leading-none">{nextAppt ? "Nobody's checked in yet." : "Queue is clear."}</p>
        <p className="mt-2 max-w-[320px] text-[14px] leading-relaxed text-muted">
          {nextAppt ? "They'll appear here as soon as front desk checks them in." : "Walk-ins and arrivals will appear here as soon as front desk checks them in."}
        </p>
        {nextAppt && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-pill bg-surface px-4 py-2.5 text-[12.5px] text-ink shadow-card">
            <CalendarClock size={13} className="text-primary" />
            Next · {fmtTime(nextAppt.startsAt)}
          </p>
        )}
      </div>
    );
  }

  const lastVisit = patient?.visits[0];
  const isNew = !patient?.visits.length;
  const captureTarget: CaptureTarget = { patientId: patient?.id, doctorId, appointmentId: appt?.id, symptoms: appt?.symptoms, displayName };

  // The backend resolves the same (clinicId, patientId, today) Visit row
  // every time — safe to call as often as needed without ever creating a
  // duplicate.
  const ensureVisitId = async (patientId: string): Promise<string> => {
    const { visit } = await api.post<{ visit: { id: string } }>("/api/v1/visits", {
      patientId, doctorId, appointmentId: appt?.id, symptoms: appt?.symptoms, visitDate: toDateKey(new Date()),
    });
    return visit.id;
  };

  // Every view that shows this patient's data reads from a different query
  // key — without invalidating all three, whichever isn't the one currently
  // on screen stays stale until a manual reload.
  const invalidatePatientData = async (patientId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["visits", clinicId, patientId] }),
      queryClient.invalidateQueries({ queryKey: ["patient", clinicId, patientId] }),
      queryClient.invalidateQueries({ queryKey: ["patients", clinicId] }),
    ]);
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
                <button onClick={() => void prev(doctorId)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.12] text-white" aria-label="Previous patient"><ChevronLeft size={20} /></button>
                {role === "doctor" ? (
                  <button onClick={() => startCapture(captureTarget)} className="pressable flex h-14 items-center gap-2.5 rounded-pill bg-white px-5 text-[13.5px] font-medium text-ink" aria-label="Start listening">
                    <Mic size={17} /> Listen
                  </button>
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

                <input ref={rxFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={attachPrescriptionPhoto} />

                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => { setEncounterOpen(false); startCapture(captureTarget); }}
                    className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card"
                  >
                    <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white"><Mic size={21} /></span>
                    <span><span className="block text-[13px] text-black/[0.48]">Ambient capture</span><span className="mt-1 block text-[18px] font-medium">Start listening</span></span>
                  </button>
                  <button onClick={() => rxFileRef.current?.click()} className="pressable flex min-h-[118px] items-center gap-4 rounded-[30px] bg-white/70 p-4 text-left shadow-card">
                    <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white"><Camera size={21} /></span>
                    <span><span className="block text-[13px] text-black/[0.48]">Prescription</span><span className="mt-1 block text-[18px] font-medium">Attach a photo</span></span>
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
                <span className="text-center text-[12px] text-white/[0.52]">Ready when you are</span>
                <button onClick={() => void next(doctorId)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary" aria-label="Next patient"><ChevronRight size={20} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
