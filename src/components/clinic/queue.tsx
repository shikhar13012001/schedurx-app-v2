"use client";

import { useMemo } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ArrowRight, GripVertical, UserRoundPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useClinic } from "@/stores";
import { useQueue, activeQueue } from "@/hooks/use-queue";
import { useAppointments } from "@/hooks/use-appointments";
import { usePatients } from "@/hooks/use-patients";
import type { AdaptedQueueItem } from "@/lib/adapters";
import { cn, fmtTime, toDateKey } from "@/lib/utils";

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

      <Avatar id={patient?.id ?? item.id} name={displayName} size={42} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className={cn("truncate text-[15px] font-medium tracking-[-0.02em]", isCurrent && "text-white")}>{displayName}</p>
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

export function QueueList({ doctorId }: { doctorId: string }) {
  const { reorderQueue, jumpTo } = useClinic();
  const { data: queue = [] } = useQueue();
  // Unfiltered call — QueueRow below already fetches the same query key, so
  // this shares its cache entry rather than triggering a second request.
  const { data: appointments = [] } = useAppointments();
  const { data: patients } = usePatients();
  const active = useMemo(() => activeQueue(queue).filter((q) => q.doctorId === doctorId), [queue, doctorId]);
  const otherActive = useMemo(
    () => activeQueue(queue).filter((q) => q.doctorId !== doctorId).map((q) => q.id),
    [queue, doctorId]
  );
  const currentId = (active.find((q) => q.state === "in_room") ?? active[0])?.id;

  // "The queue is clear" only means nobody's physically checked in — it says
  // nothing about whether the day actually has bookings. Without this, a
  // doctor with a full day of scheduled appointments and nobody checked in
  // yet (e.g. first thing in the morning) saw a blank "clear" state that
  // read as an empty day.
  const todayKey = toDateKey(new Date());
  const scheduledToday = useMemo(
    () =>
      appointments
        .filter((a) => a.doctorId === doctorId && toDateKey(new Date(a.startsAt)) === todayKey && ["confirmed", "tentative"].includes(a.status))
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [appointments, doctorId, todayKey]
  );

  if (active.length === 0) {
    if (scheduledToday.length > 0) {
      return (
        <div className="rounded-panel bg-surface-soft px-5 py-6">
          <p className="font-display text-[22px] font-light tracking-[-0.04em]">No one checked in yet.</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            {scheduledToday.length} appointment{scheduledToday.length === 1 ? "" : "s"} scheduled today — check a patient in when they arrive.
          </p>
          <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
            {scheduledToday.map((appointment) => {
              const patient = patients?.find((p) => p.id === appointment.patientId);
              return (
                <div key={appointment.id} className="flex min-h-[56px] items-center gap-3">
                  <span className="w-[54px] shrink-0 text-[12px] tabular-nums text-muted">{fmtTime(appointment.startsAt)}</span>
                  <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{patient?.name ?? "Patient"}</p>
                  {appointment.critical && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-label="Critical" />}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
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
    </div>
  );
}
