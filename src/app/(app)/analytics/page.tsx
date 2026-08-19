"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { useClinic, useSession } from "@/stores";
import { useAnalyticsSummary, useUtilization, usePracticePulse } from "@/hooks/use-analytics";
import { useAppointments } from "@/hooks/use-appointments";
import { cn, inr } from "@/lib/utils";

// recharts is a heavy dependency (~100kB) that only matters once "Full
// analytics" is expanded — loaded on demand instead of on every visit here.
const AnalyticsCharts = dynamic(() => import("@/components/clinic/analytics-charts"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-panel bg-surface-soft" />,
});

function AnalyticsInner() {
  const { settings } = useClinic();
  const { data: appointments = [] } = useAppointments();
  const { data: summary } = useAnalyticsSummary(30);
  const { data: utilizationData } = useUtilization(7);
  const { data: insights } = usePracticePulse();
  const stats = summary?.daily ?? [];
  const [showAll, setShowAll] = useState(settings.viewMode === "advanced");

  const total = summary?.totals.appointments ?? 0;
  const revenue = summary?.totals.revenue ?? 0;
  const noShows = summary?.totals.cancellations ?? 0;
  const noShowRate = total ? Math.round((noShows / total) * 100) : 0;
  const utilization = (utilizationData ?? []).map((doctor) => ({ name: doctor.doctorName?.split(" ")[1] ?? doctor.doctorName, pct: doctor.utilizationPct }));
  const statusRows = useMemo(() => {
    const labels = {
      confirmed: "Confirmed",
      completed: "Completed",
      tentative: "Tentative",
      waitlist: "Waitlist",
      no_show: "No-show",
      cancelled: "Cancelled",
    } as const;
    const rows = Object.entries(labels).map(([status, label]) => ({
      status,
      label,
      count: appointments.filter((appointment) => appointment.status === status).length,
    }));
    const max = Math.max(1, ...rows.map((row) => row.count));
    return rows.map((row) => ({ ...row, pct: (row.count / max) * 100 }));
  }, [appointments]);

  return (
    <div className="stagger mx-auto max-w-[1120px] space-y-8">
      <header>
        <p className="text-[12px] text-muted">Practice pulse</p>
        <h1 className="mt-1 font-display text-[clamp(2.8rem,11vw,4.2rem)] font-light leading-[0.94] tracking-[-0.055em]">Your clinic,<br />in motion.</h1>
      </header>

      <section className="atmosphere atmosphere-orange-right relative overflow-hidden rounded-hero bg-stone px-5 py-7 text-charcoal shadow-float dark:text-white sm:px-7 sm:py-8">
        <div className="relative z-10">
          <p className="text-[12px] text-charcoal/[0.68] dark:text-white/[0.68]">Collected · last 30 days</p>
          <p className="mt-4 font-display text-[clamp(3.7rem,16vw,6.3rem)] font-light leading-[0.82] tracking-[-0.065em] tabular-nums">{inr(revenue)}</p>
          <p className="mt-4 text-[13px] text-charcoal/[0.72] dark:text-white/[0.72]">+9% from last month</p>
          <div className="mt-7 h-[2px] overflow-hidden rounded-full bg-charcoal/[0.22] dark:bg-white/[0.24]"><div className="h-full w-[69%] bg-charcoal dark:bg-white" /></div>
          <div className="mt-3 flex justify-between text-[11.5px] text-charcoal/[0.68] dark:text-white/[0.68]"><span>{total} appointments</span><span>{noShowRate}% no-show</span></div>
        </div>
      </section>

      <section className="rounded-panel bg-surface px-5 py-6 shadow-card">
        <div className="flex items-center gap-3">
          <span className="ai-control flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><Sparkles size={16} /></span>
          <div>
            <p className="text-[11.5px] text-muted">Practice pulse</p>
            <p className="text-[17px] font-medium tracking-[-0.03em]">One useful pattern today.</p>
          </div>
        </div>
        {insights && insights.length > 0 ? (
          insights.map((insight, index) => (
            <p key={index} className={cn("leading-relaxed text-ink/[0.78]", index === 0 ? "mt-5 text-[14px]" : "mt-2 text-[12px] text-muted")}>{insight}</p>
          ))
        ) : (
          <p className="mt-5 text-[14px] leading-relaxed text-muted">No pattern flagged yet — check back once there&apos;s more of the day&apos;s data in.</p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3 border-y border-border/60 py-5">
        <div><p className="font-display text-[28px] font-light tracking-[-0.045em] tabular-nums">{total}</p><p className="mt-1 text-[11px] text-muted">appointments</p></div>
        <div><p className="font-display text-[28px] font-light tracking-[-0.045em] tabular-nums">{noShowRate}%</p><p className="mt-1 text-[11px] text-muted">no-show</p></div>
        <div><p className="font-display text-[28px] font-light tracking-[-0.045em] tabular-nums">61%</p><p className="mt-1 text-[11px] text-muted">return</p></div>
      </section>

      {!showAll ? (
        <button onClick={() => setShowAll(true)} className="pressable flex min-h-[78px] w-full items-center justify-between rounded-panel bg-surface-soft px-5 text-left">
          <span><span className="block text-[14px] font-medium">Full analytics</span><span className="mt-0.5 block text-[11.5px] text-muted">Charts and utilization</span></span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"><ArrowRight size={17} /></span>
        </button>
      ) : (
        <div className="space-y-6">
          <AnalyticsCharts stats={stats} />

          <section className="rounded-panel bg-surface px-5 py-6 shadow-card">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[12px] text-muted">Today by status</p><p className="mt-1 text-[19px] font-medium tracking-[-0.03em]">Appointment state</p></div>
              <p className="text-[11px] text-faint">live schedule</p>
            </div>
            <div className="mt-6 space-y-4">
              {statusRows.map((row) => (
                <div key={row.status}>
                  <div className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="flex items-center gap-2.5">
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        row.status === "completed" ? "bg-primary" : row.status === "confirmed" ? "bg-success" : row.status === "no_show" || row.status === "cancelled" ? "bg-danger" : "bg-stone"
                      )} />
                      <span>{row.label}</span>
                    </span>
                    <span className="tabular-nums text-muted">{row.count}</span>
                  </div>
                  <div className="mt-2 h-px bg-border/70">
                    <div className={cn("h-px", row.status === "completed" ? "bg-primary" : row.status === "no_show" || row.status === "cancelled" ? "bg-danger" : "bg-stone")} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-panel bg-charcoal px-5 py-6 text-white shadow-card">
            <p className="text-[12px] text-white/[0.52]">Slot utilization</p>
            <div className="mt-5 space-y-5">
              {utilization.map((doctor) => (
                <div key={doctor.name}>
                  <div className="flex justify-between text-[12px]"><span>{doctor.name}</span><span className="text-white/[0.55]">{doctor.pct}%</span></div>
                  <div className="mt-2 h-px bg-white/[0.15]"><div className="h-px bg-primary" style={{ width: `${doctor.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Gate() {
  const session = useSession((s) => s.session!);
  const allowed = useClinic((s) => s.settings.receptionAnalytics);
  if (session.role === "receptionist" && !allowed) {
    return (
      <div className="mx-auto max-w-xl pt-12">
        <div className="rounded-panel bg-surface-soft px-7 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-muted"><Lock size={18} /></span>
          <p className="mt-5 font-display text-[31px] font-light tracking-[-0.045em]">Analytics stays with the doctor.</p>
          <p className="mx-auto mt-3 max-w-[300px] text-[13px] leading-relaxed text-muted">The doctor can enable front-desk access from Profile → Permissions.</p>
        </div>
      </div>
    );
  }
  return <AnalyticsInner />;
}

export default dynamic(() => Promise.resolve(Gate), { ssr: false });
