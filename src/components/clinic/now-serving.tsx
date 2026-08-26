"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Calendar, CalendarClock, ChevronLeft, ChevronRight, Mic, Sparkles, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useClinic, useSession } from "@/stores";
import { useAppointments } from "@/hooks/use-appointments";
import { useCurrentPatient } from "@/hooks/use-current-patient";
import { usePatients } from "@/hooks/use-patients";
import { ApiError } from "@/lib/api-client";
import type { CaptureTarget } from "@/lib/capture-session";
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
  const [fu, setFu] = useState<string | null>(null);
  const [customFollowUpOpen, setCustomFollowUpOpen] = useState(false);

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
              {/* Tapping anywhere here always goes straight to the patient
                  file — a walk-in display name (or, once, a stray internal
                  tool-call string that slipped into one) can be far longer
                  than a real name, so every element in this row needs its
                  own min-w-0: a flex item's default min-width is "auto"
                  (roughly its content's natural width), which silently
                  defeats truncate/overflow-hidden and was pushing the whole
                  card wider than the viewport. */}
              <PatientLink patientId={patient?.id} className="flex min-w-0 flex-1 items-start gap-3.5">
                <Avatar id={patient?.id ?? current.id} name={displayName ?? "Guest"} size={compact ? 48 : 58} ring={!compact} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className={cn("min-w-0 truncate font-display font-light leading-none tracking-[-0.05em]", compact ? "text-[22px] sm:text-[25px] text-ink" : "text-[26px] sm:text-[31px] text-white")}>{displayName ?? "Guest"}</h3>
                    {appt?.critical && <Badge tone="danger" className="shrink-0">Critical</Badge>}
                  </div>
                  {patient && (
                    <p className={cn("mt-1 truncate text-[12.5px]", compact ? "text-muted" : "text-white/[0.62]")}>{patient.age} yrs · {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "—"}{patient.tags.length ? ` · ${patient.tags.join(" · ")}` : ""}</p>
                  )}
                  {current.walkIn && <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-primary-ink"><UserRoundPlus size={12} /> Walk-in</p>}
                </div>
              </PatientLink>
              {patient && (
                <Link href={`/patients/${patient.id}`} className={cn("pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full", compact ? "bg-surface-2 text-ink" : "bg-white text-ink")} aria-label={`Open ${displayName}'s patient file`}>
                  <ArrowRight size={19} />
                </Link>
              )}
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
              <span className="mr-1 shrink-0 text-[12px] text-white/[0.58]">Follow-up</span>
              {/* min-w-0 is load-bearing here, not decorative: this div is a
                  flex item of the row above it, and a flex item's default
                  min-width is "auto" — roughly its content's natural width.
                  Without min-w-0, some browsers (Safari in particular) size
                  this to fit all 5 chips on one line rather than actually
                  respecting overflow-x-auto, pushing the whole card wider
                  than the viewport regardless of anything else on it. */}
              <div className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto">
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
    </>
  );
}
