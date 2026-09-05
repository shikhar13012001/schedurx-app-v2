"use client";

import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { useClinic, useSession } from "@/stores";
import { useAppointments } from "@/hooks/use-appointments";
import { usePatients } from "@/hooks/use-patients";
import { useDoctors } from "@/hooks/use-team";
import { ApiError } from "@/lib/api-client";
import type { Appointment } from "@/lib/types";
import { cn, fmtTime, toDateKey } from "@/lib/utils";

// Only booked/tentative appointments are draggable here — a doctor reorders
// patients they haven't seen yet, not a completed visit or their own
// blocked-out time. This has to match the backend's own scoping in
// reorderDayAppointments exactly (it validates orderedAppointmentIds as an
// exact permutation of this same status set) or every drag would be
// rejected as stale.
const REORDERABLE_STATUSES: Appointment["status"][] = ["confirmed", "tentative"];

function Row({ appointment, patientName }: { appointment: Appointment; patientName: string }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={appointment.id}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.015, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="flex min-h-[76px] items-center gap-3 border-b border-border/60 px-3 py-3 last:border-b-0"
    >
      <button
        onPointerDown={(event) => controls.start(event)}
        className="flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
        aria-label={`Reorder ${patientName}`}
      >
        <GripVertical size={16} />
      </button>
      <Avatar id={appointment.patientId ?? appointment.id} name={patientName} size={42} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium tracking-[-0.02em]">{patientName}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted">{appointment.symptoms || "No reason given"}</p>
      </div>
      <span className="tnum shrink-0 text-[13px] text-muted">{fmtTime(appointment.startsAt)}</span>
    </Reorder.Item>
  );
}

export default function ManageSchedulePage() {
  const session = useSession((s) => s.session);
  const { data: doctors } = useDoctors();
  const doctorId = session?.doctorId ?? doctors?.[0]?.id;
  const today = toDateKey(new Date());
  const { data: appointments = [], isLoading } = useAppointments({ date: today, doctorId });
  const { data: patients } = usePatients();
  const reorderDay = useClinic((s) => s.reorderDay);

  const reorderable = appointments
    .filter((a) => REORDERABLE_STATUSES.includes(a.status))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  // Local, optimistic order — synced from the query, but drives the drag UI
  // directly so a rejected reorder can snap back without waiting on a
  // refetch (and so a successful one doesn't visibly "jump" while
  // invalidate() is still in flight).
  const [order, setOrder] = useState<Appointment[]>(reorderable);
  useEffect(() => {
    setOrder(reorderable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments.length, doctorId, today]);

  if (!session) return null;
  if (session.role !== "doctor") {
    return <p className="pt-12 text-center text-muted">This screen is for doctors managing their own schedule.</p>;
  }
  if (!doctorId) return null;

  const onReorder = async (ids: string[]) => {
    const previous = order;
    const next = ids.map((id) => previous.find((a) => a.id === id)!).filter(Boolean);
    setOrder(next); // optimistic
    try {
      await reorderDay(doctorId, today, ids);
    } catch (err) {
      setOrder(previous); // snap back — this is a real reschedule, not a cosmetic reorder, so a rejection must not leave the list looking like it succeeded
      toast.error(err instanceof ApiError ? err.message : "Couldn't reorder — try again.");
    }
  };

  return (
    <div className="stagger mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-[12px] text-muted">Today · {order.length} appointment{order.length === 1 ? "" : "s"}</p>
        <h1 className="mt-1 font-display text-[clamp(2.2rem,7vw,3rem)] font-light leading-[0.98] tracking-[-0.05em]">
          Manage today&apos;s appointments
        </h1>
        <p className="mt-3 max-w-[46ch] text-[13px] leading-relaxed text-muted">
          Drag to reorder. This actually changes each appointment&apos;s booked time — patients whose time moves get notified, same as any other reschedule.
        </p>
      </header>

      {isLoading ? null : order.length === 0 ? (
        <div className="rounded-panel bg-surface-soft px-6 py-10 text-center">
          <p className="font-display text-[24px] font-light tracking-[-0.04em]">Nothing to reorder.</p>
          <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
            No upcoming booked appointments left today.
          </p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={order.map((a) => a.id)}
          onReorder={(ids: string[]) => void onReorder(ids)}
          className={cn("overflow-hidden rounded-panel bg-surface px-1 py-1 shadow-card")}
        >
          {order.map((appointment) => (
            <Row
              key={appointment.id}
              appointment={appointment}
              patientName={patients?.find((p) => p.id === appointment.patientId)?.name ?? "Guest"}
            />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}
