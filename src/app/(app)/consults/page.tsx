"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArchiveIcon, ArrowRight, ChevronDown, MessageCircleMore, Phone, Search, ShieldAlert, Video } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { useSession } from "@/stores";
import { useThreads } from "@/hooks/use-threads";
import type { AdaptedThread } from "@/lib/adapters";
import { useAppointments } from "@/hooks/use-appointments";
import { usePatients } from "@/hooks/use-patients";
import { cn, fmtTime, relTime, sortThreadsByTriage, triageLabel } from "@/lib/utils";

// No stored "archived" status — deliberately computed purely from
// lastMessageAt's age, same "never persisted, always re-derived" posture
// use-queue.ts's listPossibleNoShows already uses for the same reason: a
// thread that gets a new message tomorrow should just naturally reappear in
// the active list without any explicit "unarchive" action or migration.
const ARCHIVE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
function isStale(thread: { lastMessageAt?: string }) {
  return !!thread.lastMessageAt && Date.now() - +new Date(thread.lastMessageAt) > ARCHIVE_AFTER_MS;
}

function ConsultsInner() {
  const params = useSearchParams();
  const session = useSession((s) => s.session!);
  const { data: threads = [] } = useThreads();
  const { data: appointments = [] } = useAppointments();
  const { data: patients } = usePatients();
  const [query, setQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const sorted = useMemo(() => sortThreadsByTriage(threads.filter((t) => !isStale(t))), [threads]);
  const archived = useMemo(() => sortThreadsByTriage(threads.filter(isStale)), [threads]);
  const online = useMemo(
    () => appointments
      .filter((a) => (a.mode === "video" || a.mode === "audio") && ["confirmed", "tentative"].includes(a.status))
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [appointments]
  );
  const matchesQuery = useCallback(
    (thread: { patientId: string }) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      const patient = patients?.find((item) => item.id === thread.patientId);
      return patient?.name.toLowerCase().includes(needle) ?? false;
    },
    [query, patients]
  );
  const visibleThreads = useMemo(() => sorted.filter(matchesQuery), [sorted, matchesQuery]);
  const visibleArchived = useMemo(() => archived.filter(matchesQuery), [archived, matchesQuery]);
  const unread = threads.reduce((sum, thread) => sum + thread.unread, 0);

  const renderThreadRow = (thread: AdaptedThread, isLast: boolean) => {
    const patient = patients?.find((item) => item.id === thread.patientId);
    return (
      <Link
        key={thread.id}
        href={`/consults/${thread.id}`}
        className={cn(
          "group flex min-h-[88px] items-center gap-3.5 rounded-[26px] px-3 py-3 transition-colors hover:bg-surface-soft",
          !isLast && "border-b border-border/[0.45]",
          thread.triage === "critical" && "bg-danger/[0.035]"
        )}
      >
        <div className="relative shrink-0">
          <Avatar id={patient?.id ?? thread.id} name={patient?.name ?? "Patient"} size={46} />
          {thread.unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn("truncate text-[15px] tracking-[-0.025em]", thread.unread ? "font-semibold" : "font-medium")}>{patient?.name ?? "Patient"}</p>
            {thread.lastMessageAt && <span className="ml-auto shrink-0 text-[10.5px] text-faint">{relTime(thread.lastMessageAt)}</span>}
          </div>
          <p className={cn("mt-1 line-clamp-1 text-[13px]", thread.unread ? "text-ink/[0.78]" : "text-muted")}>{thread.unread > 0 ? `${thread.unread} unread message${thread.unread > 1 ? "s" : ""}` : "Tap to view conversation"}</p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            <span className={thread.triage === "critical" ? "text-danger" : thread.triage === "moderate" ? "text-muted" : "text-faint"}>{triageLabel(thread.triage)}</span>
            {thread.escalated && <span className="inline-flex items-center gap-1 text-danger"><ShieldAlert size={10} /> Escalated</span>}
            {thread.paid && <span className="text-faint">· Paid chat</span>}
            {thread.scope === "booking" && <span className="text-faint">· Booking</span>}
          </div>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft transition-transform group-hover:translate-x-0.5"><ArrowRight size={17} /></span>
      </Link>
    );
  };

  return (
    <div className="stagger mx-auto max-w-[980px] space-y-7">
      <header>
        <p className="text-[12px] text-muted">Care conversations</p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h1 className="font-display text-[clamp(3rem,12vw,4.4rem)] font-light leading-[0.94] tracking-[-0.055em]">Consults</h1>
          {unread > 0 && <p className="pb-1 text-[12px] text-muted"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />{unread} unread</p>}
        </div>
      </header>

      <label className="relative block" data-noswipe>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search conversations…" className="h-14 w-full rounded-pill bg-surface-soft pl-12 pr-4 text-[14px] text-ink outline-none placeholder:text-muted focus:ring-4 focus:ring-primary/10" />
      </label>

      <Tabs defaultValue={params.get("tab") === "online" ? "online" : "inbox"}>
        <TabsList>
          <TabsTrigger value="inbox">Conversations</TabsTrigger>
          <TabsTrigger value="online">Online</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <p className="px-1 text-[12px] leading-relaxed text-faint">ScheduRx quietly keeps urgent messages near the top.</p>
          <div className="overflow-hidden rounded-panel bg-surface p-1 shadow-card">
            {visibleThreads.map((thread, index) => renderThreadRow(thread, index === visibleThreads.length - 1))}
            {visibleThreads.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="font-display text-[27px] font-light tracking-[-0.045em]">No conversation found.</p>
                <p className="mt-2 text-[12px] text-muted">Try the patient name or a phrase from the message.</p>
              </div>
            )}
          </div>

          {archived.length > 0 && (
            <div>
              <button
                onClick={() => setArchiveOpen((v) => !v)}
                className="pressable flex h-12 w-full items-center gap-2.5 rounded-pill bg-surface-soft px-4 text-[13px] text-muted"
              >
                <ArchiveIcon size={14} />
                <span className="flex-1 text-left">Archived · {archived.length} conversation{archived.length === 1 ? "" : "s"} inactive 3+ days</span>
                <ChevronDown size={16} className={cn("transition-transform", archiveOpen && "rotate-180")} />
              </button>
              {archiveOpen && (
                <div className="mt-2 overflow-hidden rounded-panel bg-surface p-1 opacity-80 shadow-card">
                  {visibleArchived.map((thread, index) => renderThreadRow(thread, index === visibleArchived.length - 1))}
                  {visibleArchived.length === 0 && (
                    <p className="px-5 py-6 text-center text-[12px] text-muted">No archived conversation matches that search.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="online" className="space-y-5">
          {online.length === 0 && <Empty icon={Video} title="No online consults today" body="Video and audio bookings will settle here with their join actions." />}
          {online.map((appointment) => {
            const patient = patients?.find((item) => item.id === appointment.patientId);
            const Icon = appointment.mode === "video" ? Video : Phone;
            const mins = Math.round((+new Date(appointment.startsAt) - Date.now()) / 60000);
            const startingSoon = mins < 90;
            return (
              <section
                key={appointment.id}
                className={cn(
                  "relative overflow-hidden rounded-panel px-5 py-5",
                  startingSoon ? "bg-charcoal text-white shadow-float" : "bg-surface shadow-card"
                )}
              >
                {startingSoon && <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/25 blur-[60px]" />}
                <div className="relative flex items-center gap-4">
                  <Avatar id={patient?.id ?? appointment.id} name={patient?.name ?? "Patient"} size={50} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[11.5px]", startingSoon ? "text-white/[0.52]" : "text-muted")}>{startingSoon ? (mins <= 1 ? "Starting now" : `Starts in ${Math.max(1, mins)} min`) : fmtTime(appointment.startsAt)}</p>
                    <p className="mt-1 truncate text-[17px] font-medium tracking-[-0.03em]">{patient?.name}</p>
                    <p className={cn("mt-0.5 truncate text-[12px]", startingSoon ? "text-white/[0.58]" : "text-muted")}>{appointment.durationMin} min · {appointment.symptoms}</p>
                  </div>
                  {appointment.mode === "video" && appointment.meetLink ? (
                    <a href={appointment.meetLink} target="_blank" rel="noreferrer" className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-charcoal" aria-label={`Join ${patient?.name}`}><Icon size={18} /></a>
                  ) : (
                    <a href={`tel:${patient?.phone ?? ""}`} className={cn("pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full", startingSoon ? "bg-white text-charcoal" : "bg-surface-soft text-ink")} aria-label={`Call ${patient?.name}`}><Icon size={18} /></a>
                  )}
                </div>
                {session.role === "doctor" && (
                  <div className={cn("relative mt-5 flex gap-2 border-t pt-4", startingSoon ? "border-white/10" : "border-border/60")}> 
                    <Link href={`/patients/${appointment.patientId}`} className={cn("pressable flex-1 rounded-pill py-3 text-center text-[12px]", startingSoon ? "bg-white/10 text-white/80" : "bg-surface-soft text-muted")}>Patient file</Link>
                    <Link href={`/patients/${appointment.patientId}?rx=1`} className={cn("pressable flex-1 rounded-pill py-3 text-center text-[12px]", startingSoon ? "bg-white/10 text-white/80" : "bg-surface-soft text-muted")}>Prescription</Link>
                  </div>
                )}
              </section>
            );
          })}
          {online.length > 0 && <p className="px-1 pt-1 text-[11.5px] leading-relaxed text-faint">Join links stay with the booking; ScheduRx keeps reminders and the patient file close to the call.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ConsultsPage() {
  return (
    <Suspense fallback={<div className="pt-12 text-center text-muted"><MessageCircleMore className="mx-auto mb-3 animate-pulse" /></div>}>
      <ConsultsInner />
    </Suspense>
  );
}
