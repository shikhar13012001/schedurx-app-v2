"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useClinic } from "@/stores";
import { useDoctors } from "@/hooks/use-team";
import { useAvailableSlots } from "@/hooks/use-available-slots";
import { ApiError } from "@/lib/api-client";
import { cn, dateAt, toDateKey } from "@/lib/utils";
import type { Appointment } from "@/lib/types";

// Picks a new day/time for an existing appointment — a sibling to
// BookingSheet rather than a mode of it, since a reschedule needs none of
// booking's patient-identity/consultation-mode/token fields (the patient is
// already known) and forcing both shapes through one zod schema would be
// messier than two small, purpose-built forms.
export function RescheduleSheet({ open, onOpenChange, appointment }: {
  open: boolean; onOpenChange: (o: boolean) => void; appointment: Appointment | null;
}) {
  const { rescheduleAppointment } = useClinic();
  const { data: doctors } = useDoctors();
  const DOCTORS = doctors ?? [];

  const [day, setDay] = useState(toDateKey(new Date()));
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !appointment) return;
    setDay(toDateKey(new Date(appointment.startsAt)));
    setTime("");
  }, [open, appointment]);

  const selectedDoctor = DOCTORS.find((d) => d.id === appointment?.doctorId);
  // Real nettu-scheduler availability — see booking-sheet.tsx's identical
  // comment for why this replaced the old clinic-hours-only math.
  const { data: availability, isLoading: slotsLoading } = useAvailableSlots({ doctorId: appointment?.doctorId, date: day });
  const slotOptions = useMemo(() => (availability?.slots ?? []).map((s) => s.start.slice(11, 16)), [availability]);
  useEffect(() => {
    if (!open || slotsLoading) return;
    if (time && slotOptions.includes(time)) return;
    setTime(slotOptions[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotOptions, open]);

  if (!appointment) return null;

  const onSubmit = async () => {
    if (!time) return;
    setSubmitting(true);
    try {
      const [h, m] = time.split(":").map(Number);
      await rescheduleAppointment(appointment.id, appointment.doctorId, dateAt(day, h, m));
      toast.success("Appointment rescheduled");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reschedule that appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reschedule appointment">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Doctor</p>
          <div className={cn("flex h-11 items-center rounded-pill bg-surface-soft px-4 text-[13px] text-muted")}>
            {selectedDoctor?.name ?? "—"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <Input type="date" min={toDateKey(new Date())} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Time" hint={selectedDoctor ? `${selectedDoctor.slotMinutes}-min slots` : undefined}>
            <select value={time} onChange={(e) => setTime(e.target.value)} disabled={slotsLoading} className="h-12 w-full rounded-field bg-surface-soft px-3.5 text-[14px] text-ink outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60">
              {slotsLoading && <option value="">Loading times…</option>}
              {!slotsLoading && slotOptions.length === 0 && <option value="">No slots left that day</option>}
              {slotOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Button size="lg" className="w-full" disabled={submitting || slotsLoading || !time} onClick={onSubmit}>
          Reschedule
        </Button>
      </div>
    </Sheet>
  );
}
