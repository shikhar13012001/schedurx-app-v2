"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClockOff, CalendarPlus, Video } from "lucide-react";
import { toast } from "sonner";
import { BookingSheet } from "@/components/clinic/booking-sheet";
import { BlockTimeSheet } from "@/components/clinic/block-time";
import { RescheduleSheet } from "@/components/clinic/reschedule-sheet";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useClinic, useSession } from "@/stores";
import { ApiError } from "@/lib/api-client";
import { useDoctors } from "@/hooks/use-team";
import { usePatients } from "@/hooks/use-patients";
import { useAppointments } from "@/hooks/use-appointments";
import { cn, fmtTime, toDateKey } from "@/lib/utils";
import type { Appointment } from "@/lib/types";

const DAY_START = 8;
const DAY_END = 22;
const PX_PER_MIN = 1.42;
const TIMELINE_HEIGHT = (DAY_END - DAY_START) * 60 * PX_PER_MIN;

function topOf(iso: string) {
  const date = new Date(iso);
  return ((date.getHours() - DAY_START) * 60 + date.getMinutes()) * PX_PER_MIN;
}

function TimelineBlock({ appointment, dimmed, onSelect }: { appointment: Appointment; dimmed: boolean; onSelect: (a: Appointment) => void }) {
  const { data: patients } = usePatients();
  const patient = appointment.patientId ? patients?.find((item) => item.id === appointment.patientId) : undefined;
  const height = Math.max(appointment.durationMin * PX_PER_MIN, 42);

  if (appointment.status === "blocked") {
    // `primary-soft`/`primary-ink` are tuned for subtle chip backgrounds and
    // invert per theme (a near-black brown in dark mode) — too weak here.
    // Pull straight from the vivid `--primary` token instead so this reads
    // as orange in both themes.
    return (
      <div
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-x-0 flex cursor-default items-center gap-2.5 overflow-hidden rounded-[24px] border-2 px-4 py-3"
        style={{
          top: topOf(appointment.startsAt),
          height,
          borderColor: "rgb(var(--primary))",
          backgroundColor: "rgb(var(--primary) / .22)",
          backgroundImage: "repeating-linear-gradient(135deg, rgb(var(--primary) / .3) 0 10px, transparent 10px 20px)",
        }}
      >
        <AlarmClockOff size={14} className="shrink-0" style={{ color: "rgb(var(--primary))" }} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold" style={{ color: "rgb(var(--primary))" }}>Blocked{appointment.blockReason ? ` · ${appointment.blockReason}` : ""}</p>
          <p className="mt-0.5 text-[11px] text-ink/80">{fmtTime(appointment.startsAt)}</p>
        </div>
      </div>
    );
  }

  // Orange left-edge accent + tinted background, same --primary token as the
  // blocked treatment but lighter (.12 vs blocked's hatch) so a glance at the
  // timeline still tells "booked" and "blocked" apart.
  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        if (!dimmed) onSelect(appointment);
      }}
      className={cn(
        "absolute inset-x-0 flex flex-col justify-center overflow-hidden rounded-[25px] border-l-4 px-4 shadow-card transition-opacity",
        dimmed ? "cursor-default opacity-40" : "pressable cursor-pointer",
        appointment.critical && "ring-1 ring-danger/25"
      )}
      style={{
        top: topOf(appointment.startsAt),
        height,
        borderColor: "rgb(var(--primary))",
        backgroundColor: "rgb(var(--primary) / .12)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", appointment.critical ? "bg-danger" : "bg-primary")} />
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.025em]">{patient?.name ?? "—"}</p>
        {appointment.pay === "token" && <span className="shrink-0 text-[10px] text-faint"><span aria-hidden>₹</span><span className="sr-only">Token paid</span></span>}
        {(appointment.mode === "video" || appointment.mode === "audio") && <Video size={14} className="shrink-0 text-muted" />}
      </div>
      {height > 58 && (
        <div className="mt-1.5 flex items-center gap-2 pl-[18px] text-[11.5px] text-muted">
          <span>{fmtTime(appointment.startsAt)}</span>
          {appointment.symptoms && <><span>·</span><span className="truncate">{appointment.symptoms}</span></>}
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const session = useSession((s) => s.session);
  const { data: doctors } = useDoctors();
  const [doctorId, setDoctorId] = useState(session?.doctorId ?? "");
  const [booking, setBooking] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [prefillTime, setPrefillTime] = useState<string | undefined>(undefined);
  const [now, setNow] = useState(new Date());
  const [actionsFor, setActionsFor] = useState<Appointment | null>(null);
  const [reschedulingFor, setReschedulingFor] = useState<Appointment | null>(null);
  const { cancelAppointment } = useClinic();

  useEffect(() => {
    if (!doctorId && doctors?.[0]) setDoctorId(doctors[0].id);
  }, [doctorId, doctors]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index - 1);
      return date;
    });
  }, []);
  const [dayIndex, setDayIndex] = useState(1);
  const selectedDay = days[dayIndex];
  const selectedDayKey = toDateKey(selectedDay);
  const isToday = dayIndex === 1;
  const isPast = dayIndex < 1;

  // Scoped to the selected day + doctor server-side — previously this fetched
  // every appointment ever booked for the doctor and rendered all of them on
  // whichever day was open, positioned only by time-of-day (so old bookings
  // bled onto "today", and any outside 8am–10pm rendered off-canvas).
  const { data: dayAppointments = [] } = useAppointments({ date: selectedDayKey, doctorId });
  const nowTop = topOf(now.toISOString());
  const nowVisible = isToday && nowTop > 0 && nowTop < TIMELINE_HEIGHT;
  const slotMinutes = doctors?.find((d) => d.id === doctorId)?.slotMinutes ?? 15;

  const onCancelAppointment = async () => {
    if (!actionsFor) return;
    if (!window.confirm("Cancel this appointment? The patient will be notified.")) return;
    try {
      await cancelAppointment(actionsFor.id);
      toast.success("Appointment cancelled");
      setActionsFor(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't cancel that appointment.");
    }
  };

  const openBookingAt = (clientY: number, container: HTMLElement) => {
    if (isPast) return;
    const rect = container.getBoundingClientRect();
    const offsetMin = (clientY - rect.top) / PX_PER_MIN;
    const snapped = Math.round(offsetMin / slotMinutes) * slotMinutes;
    const clamped = Math.min((DAY_END - DAY_START) * 60 - slotMinutes, Math.max(0, snapped));
    const h = DAY_START + Math.floor(clamped / 60);
    const m = clamped % 60;
    setPrefillTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    setBooking(true);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] text-muted">Calendar</p>
          <h1 className="mt-1 font-display text-[clamp(2.8rem,11vw,4.2rem)] font-light leading-[0.95] tracking-[-0.055em]">
            {selectedDay.toLocaleDateString("en-IN", { month: "long", day: "numeric" })}
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBlocking(true)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Block time"><AlarmClockOff size={18} /></button>
          <button onClick={() => { setPrefillTime(undefined); setBooking(true); }} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary text-charcoal shadow-card" aria-label="Book appointment"><CalendarPlus size={18} /></button>
        </div>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-noswipe>
        {days.map((date, index) => (
          <button
            key={date.toISOString()}
            onClick={() => setDayIndex(index)}
            className={cn(
              "pressable flex min-w-[64px] shrink-0 flex-col items-center rounded-[24px] px-3 py-3 transition-colors",
              index === dayIndex ? "bg-charcoal text-white shadow-card" : "bg-surface text-muted shadow-card"
            )}
          >
            <span className="text-[11px]">{date.toLocaleDateString("en-IN", { weekday: "short" })}</span>
            <span className="mt-1 font-display text-[22px] font-light tabular-nums">{date.getDate()}</span>
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-noswipe>
        {(doctors ?? []).map((doctor) => (
          <button
            key={doctor.id}
            onClick={() => setDoctorId(doctor.id)}
            className={cn(
              "pressable h-11 shrink-0 rounded-pill px-4 text-[13px] transition-colors",
              doctorId === doctor.id ? "bg-stone/[0.32] text-ink" : "bg-surface text-muted"
            )}
          >
            {doctor.name.split(" ").slice(0, 2).join(" ")}
          </button>
        ))}
      </div>

      <section className={cn("rounded-panel bg-surface px-3 py-6 shadow-card sm:px-5", isPast && "opacity-70")} data-noswipe>
        {isPast && <p className="mb-4 px-1 text-[11.5px] text-faint">Past day · read-only.</p>}
        <div className="flex gap-3 sm:gap-5">
          <div className="relative w-[48px] shrink-0 select-none" style={{ height: TIMELINE_HEIGHT }}>
            {Array.from({ length: DAY_END - DAY_START + 1 }, (_, index) => {
              const hour = DAY_START + index;
              const labelHour = ((hour + 11) % 12) + 1;
              return (
                <span
                  key={hour}
                  className="absolute right-0 -translate-y-1/2 text-[10.5px] tabular-nums text-faint"
                  style={{ top: index * 60 * PX_PER_MIN }}
                >
                  {labelHour} {hour < 12 ? "AM" : "PM"}
                </span>
              );
            })}
          </div>
          <div
            className={cn("relative min-w-0 flex-1", !isPast && "cursor-pointer")}
            style={{ height: TIMELINE_HEIGHT }}
            onClick={(event) => openBookingAt(event.clientY, event.currentTarget)}
          >
            {Array.from({ length: DAY_END - DAY_START + 1 }, (_, index) => (
              <div key={index} className="absolute inset-x-0 border-t border-border/[0.45]" style={{ top: index * 60 * PX_PER_MIN }} />
            ))}
            {dayAppointments.map((appointment) => (
              <TimelineBlock
                key={appointment.id}
                appointment={appointment}
                dimmed={["completed", "no_show", "cancelled"].includes(appointment.status)}
                onSelect={setActionsFor}
              />
            ))}
            {nowVisible && (
              <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                <div className="relative h-px bg-primary">
                  <span className="absolute -left-1.5 -top-[4px] h-2.5 w-2.5 rounded-full bg-primary" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <BookingSheet open={booking} onOpenChange={setBooking} prefillTime={prefillTime} prefillDay={selectedDayKey} prefillDoctorId={doctorId} />
      <BlockTimeSheet open={blocking} onOpenChange={setBlocking} doctorId={doctorId} prefillDay={selectedDayKey} />

      <Sheet open={!!actionsFor} onOpenChange={(o) => !o && setActionsFor(null)} title="Appointment">
        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => { setReschedulingFor(actionsFor); setActionsFor(null); }}>
            Reschedule
          </Button>
          <Button size="lg" variant="danger" className="w-full" onClick={onCancelAppointment}>
            Cancel appointment
          </Button>
        </div>
      </Sheet>
      <RescheduleSheet open={!!reschedulingFor} onOpenChange={(o) => !o && setReschedulingFor(null)} appointment={reschedulingFor} />
    </div>
  );
}
