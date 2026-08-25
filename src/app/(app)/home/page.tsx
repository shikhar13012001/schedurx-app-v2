"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlarmClockOff,
  ArrowRight,
  CalendarPlus,
  ChevronDown,
  ListTodo,
  Phone,
  Search,
  UserRoundPlus,
  Video,
} from "lucide-react";
// Dynamically imported (client-only) — now-serving.tsx pulls in the
// ElevenLabs Scribe SDK for ambient capture, which added ~145kB to this
// page's First Load JS when imported statically. Same "load only when
// actually needed" discipline this codebase already uses for
// prescription-pdf.tsx's @react-pdf/renderer.
const NowServing = dynamic(() => import("@/components/clinic/now-serving").then((m) => m.NowServing), { ssr: false });
import { QueueList } from "@/components/clinic/queue";
import { BookingSheet } from "@/components/clinic/booking-sheet";
import { BlockTimeSheet } from "@/components/clinic/block-time";
import { Avatar } from "@/components/ui/avatar";
import { useClinic, useSession } from "@/stores";
import { useQueue, activeQueue } from "@/hooks/use-queue";
import { useAppointments } from "@/hooks/use-appointments";
import { useThreads } from "@/hooks/use-threads";
import { usePatients } from "@/hooks/use-patients";
import { useDoctors } from "@/hooks/use-team";
import { cn, fmtTime, toDateKey, triageLabel } from "@/lib/utils";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// Doctor.fullName is stored with the "Dr." title already included (e.g. "Dr.
// Anubhav Chandrakar") — splitting on the first space to find the given name
// was silently dropping that title from the greeting. Keep "Dr." when present
// instead of skipping past it.
function doctorGreetingName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && /^dr\.?$/i.test(parts[0])) {
    return `Dr. ${parts[1]}`;
  }
  return parts[0] ?? fullName;
}

function openAI() {
  window.dispatchEvent(new CustomEvent("srx-ai-open"));
}

function ClinicRhythm({ completed, remaining }: { completed: number; remaining: number }) {
  const total = Math.max(1, completed + remaining);
  const pct = Math.min(100, Math.max(0, (completed / total) * 100));
  return (
    <div className="mt-7">
      <div
        className="metric-track relative h-8 overflow-hidden rounded-full bg-charcoal/[0.07] dark:bg-white/[0.09]"
        aria-label={`${completed} completed, ${remaining} remaining`}
      >
        {/* A repeating gradient, not a fixed set of ticks — the hatch
            pattern tiles across however wide the completed portion is, so
            it always reaches the marker exactly instead of stopping short
            as a small fixed-size cluster stuck at the left edge. */}
        <div
          className="absolute left-0 top-1/2 h-5 -translate-y-1/2 text-charcoal/70 dark:text-white/80"
          style={{
            width: `${Math.max(8, pct)}%`,
            backgroundImage: "repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 3px)",
          }}
        />
        <span className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-charcoal/[0.78] dark:bg-white/[0.88]" style={{ left: `${pct}%` }} />
        <span className="metric-marker absolute top-1/2 h-7 w-px -translate-y-1/2 bg-charcoal dark:bg-white" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-charcoal/[0.68] dark:text-white/[0.68]">
        <span>{completed} completed</span>
        <span>{remaining} left</span>
      </div>
    </div>
  );
}

function DoctorHome({ doctorId }: { doctorId: string }) {
  const session = useSession((s) => s.session!);
  const { settings } = useClinic();
  const { data: appointments = [] } = useAppointments({ date: toDateKey(new Date()) });
  const { data: threads = [] } = useThreads();
  const { data: patients } = usePatients();
  const simple = settings.viewMode !== "advanced";
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const mine = useMemo(() => appointments.filter((a) => a.doctorId === doctorId), [appointments, doctorId]);
  const activeAppointments = useMemo(
    () => mine
      .filter((a) => ["confirmed", "tentative"].includes(a.status))
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [mine]
  );
  // Today's full schedule (not just who's physically checked in) — a doctor
  // with 2 booked appointments and nobody in the waiting room yet should see
  // "2 left", not "0", so this drives the headline stat and rhythm bar.
  const remainingToday = activeAppointments.length;
  const doneToday = mine.filter((a) => a.status === "completed").length;
  const critical = activeAppointments.filter((a) => a.critical).length;
  const online = activeAppointments.filter((a) => a.mode === "video" || a.mode === "audio");
  const urgent = threads.find((thread) => thread.doctorId === doctorId && thread.triage === "critical" && thread.unread > 0);
  const blockedUntil = mine
    .filter((a) => a.status === "blocked")
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];

  const freeLabel = blockedUntil
    ? `Clinic resumes ${fmtTime(new Date(+new Date(blockedUntil.startsAt) + blockedUntil.durationMin * 60000).toISOString())}`
    : "Schedule has room";

  return (
    <div className="stagger space-y-8">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)] xl:items-stretch">
        <section className="atmosphere atmosphere-orange-right relative -mx-1 overflow-hidden rounded-hero bg-stone px-5 pb-6 pt-6 text-charcoal shadow-float dark:text-white sm:px-7 sm:pb-8 sm:pt-7">
        <div className="relative z-10">
          <p className="text-[13px] text-charcoal/[0.68] dark:text-white/[0.68]">{session.clinicName}</p>
          <h1 className="mt-4 max-w-[330px] text-balance font-display text-[clamp(3rem,12vw,4rem)] font-light leading-[0.94] tracking-[-0.055em]">
            {greeting()},<br />{doctorGreetingName(session.name)}
          </h1>

          <div className="mt-9 flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-[clamp(4.2rem,20vw,6.4rem)] font-light leading-[0.78] tracking-[-0.065em] tabular-nums">{remainingToday}</p>
              <p className="mt-3 text-[16px] tracking-[-0.025em] text-charcoal/[0.82] dark:text-white/[0.84]">patients left</p>
            </div>
            <div className="pb-1 text-right text-[12px] leading-relaxed text-charcoal/[0.68] dark:text-white/[0.68]">
              <p>{freeLabel}</p>
              {critical > 0 ? <p className="text-charcoal dark:text-white">{critical} needs attention</p> : <p>Clinic in rhythm</p>}
            </div>
          </div>

          <ClinicRhythm completed={doneToday} remaining={remainingToday} />

          <button
            onClick={() => settings.aiAssistant && openAI()}
            disabled={!settings.aiAssistant}
            className="srx-glass-hero pressable mt-7 flex h-14 w-full items-center gap-3 rounded-pill px-4 text-left text-[14px] text-charcoal dark:text-white disabled:opacity-[0.58]"
          >
            <Search size={18} className="text-charcoal/[0.68] dark:text-white/[0.72]" />
            <span className="flex-1 text-charcoal/[0.76] dark:text-white/[0.78]">{settings.aiAssistant ? "Ask ScheduRx anything…" : "ScheduRx assistant is off"}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-charcoal"><ArrowRight size={17} /></span>
          </button>
        </div>
        </section>

        <div className="xl:[&>section]:h-full">
          <NowServing doctorId={doctorId} />
        </div>
      </div>

      {urgent && (
        <Link href={`/consults/${urgent.id}`} className="group block rounded-panel bg-surface px-5 py-5 shadow-card">
          <div className="flex items-start gap-4">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-danger">{triageLabel(urgent.triage)} priority</p>
              <p className="mt-1 text-[18px] font-medium tracking-[-0.03em]">{patients?.find((p) => p.id === urgent.patientId)?.name}</p>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{urgent.aiSummary}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft transition-transform group-hover:translate-x-0.5"><ArrowRight size={18} /></span>
          </div>
        </Link>
      )}

      {online[0] && (() => {
        const appointment = online[0];
        const patient = patients?.find((p) => p.id === appointment.patientId);
        const mins = Math.max(0, Math.round((+new Date(appointment.startsAt) - nowTick) / 60000));
        const timeLabel = mins <= 1 ? "Starting now" : mins < 60 ? `Starts in ${mins} min` : fmtTime(appointment.startsAt);
        return (
          <section className="relative overflow-hidden rounded-panel bg-charcoal px-5 py-5 text-white shadow-card">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/[0.28] blur-[54px]" />
            <div className="relative flex items-center gap-4">
              <Avatar id={patient?.id ?? "online"} name={patient?.name ?? "Online consultation"} size={48} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-white/[0.52]">{timeLabel} · online</p>
                <p className="mt-1 truncate text-[17px] font-medium tracking-[-0.03em]">{patient?.name}</p>
              </div>
              {appointment.mode === "video" && appointment.meetLink ? (
                <a
                  href={appointment.meetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-charcoal"
                  aria-label={`Join consultation with ${patient?.name ?? "patient"}`}
                >
                  <Video size={19} />
                </a>
              ) : (
                <a
                  href={`tel:${patient?.phone ?? ""}`}
                  className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-charcoal"
                  aria-label={`Call ${patient?.name ?? "patient"}`}
                >
                  <Phone size={18} />
                </a>
              )}
            </div>
          </section>
        );
      })()}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[12px] text-muted">Clinic actions</p>
            <h2 className="mt-1 font-display text-[28px] font-light tracking-[-0.045em]">Keep the day moving.</h2>
          </div>
          <button onClick={() => setOverviewOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Toggle schedule overview">
            <ChevronDown size={18} className={cn("transition-transform", overviewOpen && "rotate-180")} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setBooking(true)} className="pressable min-h-[132px] rounded-panel bg-surface p-5 text-left shadow-card">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-charcoal"><CalendarPlus size={18} /></span>
            <p className="mt-6 text-[16px] font-medium tracking-[-0.03em]">New booking</p>
          </button>
          <button onClick={() => setBlocking(true)} className="pressable min-h-[132px] rounded-panel bg-surface-soft p-5 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-charcoal shadow-card"><AlarmClockOff size={18} /></span>
            <p className="mt-6 text-[16px] font-medium tracking-[-0.03em]">Block time</p>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {overviewOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.24 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-panel bg-surface px-5 py-2 shadow-card">
                {activeAppointments.slice(0, simple ? 3 : 6).map((appointment) => {
                  const patient = patients?.find((p) => p.id === appointment.patientId);
                  return (
                    <div key={appointment.id} className="flex min-h-[64px] items-center gap-3 border-b border-border/60 last:border-0">
                      <span className="w-[58px] text-[12px] tabular-nums text-muted">{fmtTime(appointment.startsAt)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{patient?.name ?? "—"}</p>
                        <p className="truncate text-[12px] text-muted">{appointment.symptoms || appointment.mode}</p>
                      </div>
                      {appointment.critical && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                    </div>
                  );
                })}
                {activeAppointments.length === 0 && <p className="py-7 text-center text-[13px] text-muted">No more scheduled visits today.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {!simple && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/tasks" className="pressable flex min-h-[84px] items-center gap-3 rounded-panel bg-surface px-4 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft"><ListTodo size={17} /></span>
            <span className="text-[14px] font-medium">Tasks</span>
          </Link>
          <Link href="/consults?tab=online" className="pressable flex min-h-[84px] items-center gap-3 rounded-panel bg-surface px-4 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft"><Video size={17} /></span>
            <span className="text-[14px] font-medium">Online care</span>
          </Link>
        </div>
      )}

      <BookingSheet open={booking} onOpenChange={setBooking} />
      <BlockTimeSheet open={blocking} onOpenChange={setBlocking} doctorId={doctorId} />
    </div>
  );
}

function ReceptionHome() {
  const session = useSession((s) => s.session!);
  const { data: queue = [] } = useQueue();
  const { data: appointments = [] } = useAppointments({ date: toDateKey(new Date()) });
  const { data: doctors } = useDoctors();
  const { data: patients } = usePatients();
  const DOCTORS = doctors ?? [];
  const [query, setQuery] = useState("");
  const [walkIn, setWalkIn] = useState(false);
  const [booking, setBooking] = useState(false);
  const [doctorId, setDoctorId] = useState("");

  useEffect(() => {
    if (!doctorId && doctors?.[0]) setDoctorId(doctors[0].id);
    // `DOCTORS` is `doctors ?? []` — a fresh array reference every render
    // while `doctors` is loading — so this depends on `doctors` itself
    // (stable once loaded) instead, to avoid re-running every render.
  }, [doctorId, doctors]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return (patients ?? []).filter((patient) =>
      patient.name.toLowerCase().includes(normalized) || patient.phone.replace(/\D/g, "").includes(normalized.replace(/\D/g, ""))
    ).slice(0, 5);
  }, [query, patients]);

  const waitingCount = activeQueue(queue).filter((item) => item.doctorId === doctorId).length;
  const appointmentCount = appointments.filter((a) => !["blocked", "cancelled"].includes(a.status)).length;

  return (
    <div className="stagger space-y-8">
      <section className="atmosphere atmosphere-subtle relative -mx-1 overflow-hidden rounded-hero bg-stone px-5 pb-6 pt-6 text-charcoal shadow-float dark:text-white sm:px-7">
        <div className="relative z-10">
          <p className="text-[13px] text-charcoal/[0.68] dark:text-white/[0.68]">Front desk · {session.clinicName}</p>
          <h1 className="mt-4 max-w-[330px] text-balance font-display text-[clamp(3rem,12vw,4rem)] font-light leading-[0.94] tracking-[-0.055em]">
            {greeting()},<br />{session.name.split(" ")[0]}
          </h1>
          <div className="mt-9 flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-[clamp(4.2rem,20vw,6.2rem)] font-light leading-[0.78] tracking-[-0.065em] tabular-nums">{appointmentCount}</p>
              <p className="mt-3 text-[16px] text-charcoal/[0.82] dark:text-white/[0.84]">appointments today</p>
            </div>
            <p className="pb-1 text-right text-[12px] leading-relaxed text-charcoal/[0.68] dark:text-white/[0.68]">{waitingCount} in {DOCTORS.find((d) => d.id === doctorId)?.name.split(" ")[1]}’s flow</p>
          </div>

          <div className="relative mt-7" data-noswipe>
            <Search size={18} className="pointer-events-none absolute left-4 top-[19px] z-10 text-charcoal/65 dark:text-white/70" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              inputMode="search"
              placeholder="Find patient or phone number…"
              className="srx-glass-hero h-14 w-full rounded-pill pl-12 pr-4 text-[14px] text-charcoal outline-none placeholder:text-charcoal/[0.62] focus:ring-4 focus:ring-primary/[0.12] dark:text-white dark:placeholder:text-white/[0.62]"
            />
            <AnimatePresence>
              {matches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute inset-x-0 top-[64px] z-30 overflow-hidden rounded-panel bg-surface p-1 text-ink shadow-float"
                >
                  {matches.map((patient) => (
                    <Link key={patient.id} href={`/patients/${patient.id}`} className="flex min-h-[66px] items-center gap-3 rounded-[24px] px-3 hover:bg-surface-soft">
                      <Avatar id={patient.id} name={patient.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{patient.name}</span>
                        <span className="block text-[12px] text-muted">{patient.phone}</span>
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft"><ArrowRight size={16} /></span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-noswipe>
          {DOCTORS.map((doctor) => (
            <button
              key={doctor.id}
              onClick={() => setDoctorId(doctor.id)}
              className={cn(
                "pressable flex h-12 shrink-0 items-center gap-2 rounded-pill px-4 text-[13px] transition-colors",
                doctorId === doctor.id ? "bg-charcoal text-white shadow-card" : "bg-surface text-muted shadow-card"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", doctor.availableNow ? "bg-success" : "bg-stone", doctorId === doctor.id && doctor.availableNow && "bg-primary")} />
              {doctor.name.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>
      </section>

      <NowServing doctorId={doctorId} compact />

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] text-muted">Current queue</p>
            <h2 className="mt-1 font-display text-[30px] font-light tracking-[-0.045em]">{waitingCount} in flow.</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setBooking(true)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card" aria-label="New booking"><CalendarPlus size={18} /></button>
            <button onClick={() => setWalkIn(true)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary text-charcoal shadow-card" aria-label="Add walk-in"><UserRoundPlus size={18} /></button>
          </div>
        </div>
        <QueueList doctorId={doctorId} />
      </section>

      <BookingSheet open={walkIn} onOpenChange={setWalkIn} walkIn />
      <BookingSheet open={booking} onOpenChange={setBooking} />
    </div>
  );
}

export default function HomePage() {
  const session = useSession((s) => s.session);
  const { data: doctors } = useDoctors();
  // An "owner" account isn't necessarily linked to a specific Doctor row
  // (Staff.doctorId can be null — owners aren't required to be practicing
  // doctors). Fall back to the clinic's first active doctor so the doctor
  // shell has a real schedule to show instead of silently resolving to
  // nothing.
  const doctorId = session?.doctorId ?? doctors?.[0]?.id;

  if (!session) return null;
  if (session.role !== "doctor") return <ReceptionHome />;
  if (!doctorId) return null;
  return <DoctorHome doctorId={doctorId} />;
}
