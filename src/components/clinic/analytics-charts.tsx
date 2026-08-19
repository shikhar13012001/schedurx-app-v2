"use client";

// Split out from analytics/page.tsx and loaded via next/dynamic — recharts
// is a heavy dependency that was previously bundled into every visit to
// Analytics even though these charts sit behind the "Full analytics" toggle
// and most visits never expand it.
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr } from "@/lib/utils";

const tooltipStyle = {
  background: "rgb(var(--surface))",
  border: "0",
  borderRadius: 18,
  boxShadow: "0 16px 44px rgba(24,24,24,.10)",
  fontSize: 12,
  color: "rgb(var(--ink))",
};

export default function AnalyticsCharts({ stats }: { stats: { label: string; appointments: number; revenue: number }[] }) {
  return (
    <>
      <section className="rounded-panel bg-surface px-4 py-5 shadow-card">
        <div className="px-2">
          <p className="text-[12px] text-muted">Bookings · 30 days</p>
          <p className="mt-1 text-[19px] font-medium tracking-[-0.03em]">Demand rhythm</p>
        </div>
        <div className="mt-5 h-56" data-noswipe>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats} margin={{ left: -30, right: 2, top: 4, bottom: 0 }}>
              <XAxis dataKey="label" interval={6} tickLine={false} axisLine={false} tick={{ fill: "rgb(var(--muted))", fontSize: 10 }} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "rgb(var(--stone) / .08)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="appointments" fill="rgb(var(--primary))" radius={[8, 8, 8, 8]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-panel bg-surface px-4 py-5 shadow-card">
        <div className="px-2">
          <p className="text-[12px] text-muted">Revenue · 30 days</p>
          <p className="mt-1 text-[19px] font-medium tracking-[-0.03em]">Collection curve</p>
        </div>
        <div className="mt-5 h-56" data-noswipe>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats} margin={{ left: -24, right: 4, top: 4 }}>
              <defs>
                <linearGradient id="srx-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" interval={6} tickLine={false} axisLine={false} tick={{ fill: "rgb(var(--muted))", fontSize: 10 }} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => inr(value)} />
              <Area dataKey="revenue" stroke="rgb(var(--primary))" strokeWidth={2} fill="url(#srx-revenue)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
