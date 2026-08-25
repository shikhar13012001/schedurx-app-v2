"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Reorder, useDragControls } from "framer-motion";
import { ArrowRight, GripVertical, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useClinic } from "@/stores";
import { useQueue, usePossibleNoShows, activeQueue } from "@/hooks/use-queue";
import { useAppointments } from "@/hooks/use-appointments";
import { usePatients } from "@/hooks/use-patients";
import { ApiError } from "@/lib/api-client";
import { APPT_STATUS_META } from "@/lib/appt-status";
import type { AdaptedQueueItem, PossibleNoShow } from "@/lib/adapters";
import type { ApptStatus } from "@/lib/types";
import { cn, fmtTime, toDateKey } from "@/lib/utils";

const BOOKABLE_STATUSES: ApptStatus[] = ["confirmed", "tentative"];

// Walk-ins with no patient record have nowhere to link — renders as a plain,
// non-interactive wrapper for them instead of a dead/empty href.
function PatientLink({ patientId, className, children }: { patientId?: string; className?: string; children: ReactNode }) {
  if (!patientId) return <div className={className}>{children}</div>;
  return (
    <Link href={`/patients/${patientId}`} className={className}>
      {children}
    </Link>
  );
}

function waitLabel(arrivedAt?: string) {
  if (!arrivedAt) return "waiting";
  const mins = Math.max(0, Math.round((Date.now() - +new Date(arrivedAt)) / 60000));
  if (mins < 2) return "just arrived";
  return `waiting ${mins} min`;
}

function QueueRow({
  item,
  index,
  isCurrent,
  onServe,
}: {
  item: AdaptedQueueItem;
  index: number;
  isCurrent: boolean;
  onServe: () => void;
}) {
  const controls = useDragControls();
  const { data: patients } = usePatients();
  const { data: appointments } = useAppointments();
  const patient = patients?.find((p) => p.id === item.patientId);
  const appt = appointments?.find((a) => a.id === item.apptId);
  const displayName = patient?.name ?? item.displayName ?? "Guest";
  if (!patient && !item.displayName) return null;

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.015, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "queue-row group relative flex min-h-[76px] items-center gap-3 px-3 py-3",
        isCurrent
          ? "rounded-[26px] bg-charcoal text-white shadow-float"
          : "border-b border-border/60 last:border-b-0"
      )}
    >
      <button
        onPointerDown={(event) => controls.start(event)}
        className={cn(
          "flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing",
          isCurrent ? "text-white/[0.35]" : "text-faint"
        )}
        aria-label={`Reorder ${displayName}`}
      >
        <GripVertical size={16} />
      </button>

      <span
        className={cn(
          "w-6 shrink-0 text-center font-display text-[17px] font-light tabular-nums",
          isCurrent ? "text-white/[0.52]" : "text-faint"
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <PatientLink patientId={patient?.id}>
        <Avatar id={patient?.id ?? item.id} name={displayName} size={42} />
      </PatientLink>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <PatientLink
            patientId={patient?.id}
            className={cn("truncate text-[15px] font-medium tracking-[-0.02em] hover:underline", isCurrent && "text-white")}
          >
            {displayName}
          </PatientLink>
          {appt?.critical && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-label="Critical" />}
        </div>
        <div className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]", isCurrent ? "text-white/[0.55]" : "text-muted")}> 
          <span>{isCurrent ? "Now serving" : waitLabel(item.arrivedAt)}</span>
          <span aria-hidden>·</span>
          <span>{appt ? fmtTime(appt.startsAt) : "walk-in"}</span>
          {item.walkIn && (
            <span className={cn("inline-flex items-center gap-1", isCurrent ? "text-white/[0.68]" : "text-ink/[0.55]")}>
              <UserRoundPlus size={11} /> Walk-in
            </span>
          )}
        </div>
      </div>

      {isCurrent ? (
        <span className="mr-1 inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-[12px] text-white/[0.82]">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Live
        </span>
      ) : (
        <button
          onClick={onServe}
          className="pressable mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.7)] transition-colors hover:bg-white"
          aria-label={`Serve ${displayName} now`}
        >
          <ArrowRight size={18} />
        </button>
      )}
    </Reorder.Item>
  );
}

// One tap either resolves the prompt (patient turned up late) or finalizes
// it — never automatic, matching the check-in plan's "a person confirms it"
// scope. Shown regardless of whether anyone else is currently in the active
// queue, since a no-show can happen while the doctor is mid-consult with a
// different patient entirely.
function PossibleNoShowCard({ candidate }: { candidate: PossibleNoShow }) {
  const { checkInAppointment, confirmNoShow } = useClinic();
  const { data: patients } = usePatients();
  const [busy, setBusy] = useState<"checkin" | "noshow" | null>(null);
  const patient = patients?.find((p) => p.id === candidate.patientId);
  const mins = Math.max(0, Math.round((Date.now() - +new Date(candidate.startsAt)) / 60000));

  const onCheckIn = async () => {
    setBusy("checkin");
    try {
      await checkInAppointment(candidate.appointmentId, candidate.doctorId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't check them in.");
    } finally {
      setBusy(null);
    }
  };
  const onConfirm = async () => {
    if (!window.confirm(`Mark ${patient?.name ?? "this patient"} as a no-show? They'll be notified.`)) return;
    setBusy("noshow");
    try {
      await confirmNoShow(candidate.appointmentId);
      toast.success("Marked as a no-show");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't confirm that no-show.");
      setBusy(null);
    }
  };

  return (
    <div className="rounded-[22px] bg-warning-soft px-4 py-3.5">
      <p className="text-[14.5px] font-semibold text-ink">{patient?.name ?? "Patient"} hasn&apos;t checked in</p>
      <p className="mt-0.5 text-[12.5px] text-warning">
        {fmtTime(candidate.startsAt)} appointment · {mins} min past start, no arrival logged.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onCheckIn}
          disabled={busy !== null}
          className="pressable h-9 flex-1 rounded-pill bg-charcoal text-[12.5px] font-medium text-white disabled:opacity-60"
        >
          {busy === "checkin" ? "Checking in…" : "They arrived"}
        </button>
        <button
          onClick={onConfirm}
          disabled={busy !== null}
          className="pressable h-9 flex-1 rounded-pill bg-danger text-[12.5px] font-medium text-white disabled:opacity-60"
        >
          {busy === "noshow" ? "Confirming…" : "Confirm no-show"}
        </button>
      </div>
    </div>
  );
}

function ArrivingRow({
  appointment,
  patient,
}: {
  appointment: { id: string; doctorId: string; startsAt: string; critical?: boolean; status: ApptStatus };
  patient?: { id: string; name: string };
}) {
  const { checkInAppointment } = useClinic();
  const [busy, setBusy] = useState(false);
  const bookable = BOOKABLE_STATUSES.includes(appointment.status);

  const onCheckIn = async () => {
    setBusy(true);
    try {
      await checkInAppointment(appointment.id, appointment.doctorId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't check them in.");
      setBusy(false);
    }
  };

  const meta = APPT_STATUS_META[appointment.status];

  return (
    <div className="flex min-h-[56px] items-center gap-3">
      <span className="w-[54px] shrink-0 text-[12px] tabular-nums text-muted">{fmtTime(appointment.startsAt)}</span>
      <PatientLink patientId={patient?.id} className="min-w-0 flex-1 truncate text-[14px] font-medium hover:underline">
        {patient?.name ?? "Patient"}
      </PatientLink>
      {appointment.critical && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-label="Critical" />}
      {bookable ? (
        <button
          onClick={onCheckIn}
          disabled={busy}
          className="pressable h-8 shrink-0 rounded-pill bg-surface-2 px-3.5 text-[12px] font-medium text-ink disabled:opacity-60"
        >
          {busy ? "Checking in…" : "Check in"}
        </button>
      ) : (
        <Badge tone={meta.tone} className="shrink-0">
          {meta.label}
        </Badge>
      )}
    </div>
  );
}

export function QueueList({ doctorId }: { doctorId: string }) {
  const { reorderQueue, jumpTo } = useClinic();
  const { data: queue = [] } = useQueue();
  // Unfiltered call — QueueRow below already fetches the same query key, so
  // this shares its cache entry rather than triggering a second request.
  const { data: appointments = [] } = useAppointments();
  const { data: patients } = usePatients();
  const { data: possibleNoShows = [] } = usePossibleNoShows();
  const active = useMemo(() => activeQueue(queue).filter((q) => q.doctorId === doctorId), [queue, doctorId]);
  const otherActive = useMemo(
    () => activeQueue(queue).filter((q) => q.doctorId !== doctorId).map((q) => q.id),
    [queue, doctorId]
  );
  const currentId = (active.find((q) => q.state === "in_room") ?? active[0])?.id;
  const activeApptIds = useMemo(() => new Set(active.map((q) => q.apptId).filter(Boolean)), [active]);

  const noShowsForDoctor = useMemo(() => possibleNoShows.filter((c) => c.doctorId === doctorId), [possibleNoShows, doctorId]);
  const noShowIds = useMemo(() => new Set(noShowsForDoctor.map((c) => c.appointmentId)), [noShowsForDoctor]);

  const noShowSection = noShowsForDoctor.length > 0 && (
    <div className="mb-3 space-y-2">
      {noShowsForDoctor.map((candidate) => (
        <PossibleNoShowCard key={candidate.appointmentId} candidate={candidate} />
      ))}
    </div>
  );

  // The full day's schedule for this doctor, every status included — the
  // active queue above only shows who's physically checked in, so without
  // this a front desk glancing at "queue" has no way to see the rest of the
  // day at a glance. Appointments already surfaced elsewhere (currently
  // checked in, or flagged as a possible no-show) are left out to avoid
  // showing the same appointment twice.
  const todayKey = toDateKey(new Date());
  const todaysAppointments = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            a.doctorId === doctorId &&
            toDateKey(new Date(a.startsAt)) === todayKey &&
            !noShowIds.has(a.id) &&
            !activeApptIds.has(a.id)
        )
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [appointments, doctorId, todayKey, noShowIds, activeApptIds]
  );
  const stillToArrive = useMemo(() => todaysAppointments.filter((a) => BOOKABLE_STATUSES.includes(a.status)), [todaysAppointments]);

  const scheduleList = (heading: string) => (
    <div className="rounded-panel bg-surface-soft px-5 py-5">
      <p className="text-[13px] font-medium text-muted">{heading}</p>
      <div className="mt-3 divide-y divide-border/60 border-t border-border/60">
        {todaysAppointments.map((appointment) => (
          <ArrivingRow key={appointment.id} appointment={appointment} patient={patients?.find((p) => p.id === appointment.patientId)} />
        ))}
      </div>
    </div>
  );

  if (active.length === 0) {
    if (stillToArrive.length > 0) {
      return (
        <>
          {noShowSection}
          <div className="rounded-panel bg-surface-soft px-5 py-6">
            <p className="font-display text-[22px] font-light tracking-[-0.04em]">No one checked in yet.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {stillToArrive.length} appointment{stillToArrive.length === 1 ? "" : "s"} still to arrive today.
            </p>
            <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
              {todaysAppointments.map((appointment) => (
                <ArrivingRow key={appointment.id} appointment={appointment} patient={patients?.find((p) => p.id === appointment.patientId)} />
              ))}
            </div>
          </div>
        </>
      );
    }
    if (todaysAppointments.length > 0) {
      return (
        <>
          {noShowSection}
          {scheduleList("Today's schedule — all caught up")}
        </>
      );
    }
    if (noShowSection) return <>{noShowSection}</>;
    return (
      <div className="rounded-panel bg-surface-soft px-6 py-10 text-center">
        <p className="font-display text-[27px] font-light tracking-[-0.045em]">No appointments today.</p>
        <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
          Check a patient in from search or add a walk-in when someone arrives.
        </p>
      </div>
    );
  }

  return (
    <div data-noswipe>
      {noShowSection}
      <Reorder.Group
        axis="y"
        values={active.map((q) => q.id)}
        onReorder={(ids: string[]) => void reorderQueue([...ids, ...otherActive])}
        className="overflow-hidden rounded-panel bg-surface px-1 py-1 shadow-card"
      >
        {active.map((item, index) => (
          <QueueRow
            key={item.id}
            item={item}
            index={index}
            isCurrent={item.id === currentId}
            onServe={() => void jumpTo(doctorId, item.id)}
          />
        ))}
      </Reorder.Group>
      <p className="mt-3 px-3 text-[11px] leading-relaxed text-faint">Drag the subtle grip to reorder · arrow sends a patient in out of turn.</p>
      {todaysAppointments.length > 0 && <div className="mt-4">{scheduleList("Rest of today's schedule")}</div>}
    </div>
  );
}
