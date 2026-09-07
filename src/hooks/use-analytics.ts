"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { fromApiDayStat, type ApiDayStat } from "@/lib/adapters";
import { useSession } from "@/stores";

export function useAnalyticsSummary(days = 30) {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["analytics-summary", clinicId, days],
    enabled: !!clinicId,
    queryFn: async () => {
      const { daily, totals, previousTotals } = await api.get<{
        daily: ApiDayStat[];
        totals: { appointments: number; revenue: number; cancellations: number };
        previousTotals: { appointments: number; revenue: number; cancellations: number };
      }>(`/api/v1/analytics/summary?days=${days}`);
      return { daily: daily.map(fromApiDayStat), totals, previousTotals };
    },
  });
}

export function useUtilization(days = 7) {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["utilization", clinicId, days],
    enabled: !!clinicId,
    queryFn: async () => {
      const { doctors } = await api.get<{
        doctors: { doctorId: string; doctorName: string; totalPossibleSlots: number; bookedSlots: number; utilizationPct: number }[];
      }>(`/api/v1/analytics/utilization?days=${days}`);
      return doctors;
    },
  });
}

export interface EnterpriseAnalytics {
  revenueByDoctor: { doctorId: string; doctorName: string; amountInr: number }[];
  revenueByMode: { mode: string; amountInr: number }[];
  outstanding: { count: number; amountInr: number };
  noShow: { total: number; noShows: number; noShowRatePct: number };
  queueTimings: { avgWaitMinutes: number | null; avgVisitMinutes: number | null };
  returnRateByDoctor: { doctorId: string; doctorName: string; totalPatients: number; returningPatients: number; returnRatePct: number }[];
  repeatVisitTrend: { month: string; totalVisits: number; repeatVisits: number; repeatRatePct: number }[];
}

// Financial/operational/patient-level breakdowns beyond the single summary
// card above — see analytics-service.js's own comment for why these read
// live tables directly rather than the day_stats view.
export function useEnterpriseAnalytics(days = 30) {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["analytics-enterprise", clinicId, days],
    enabled: !!clinicId,
    queryFn: async () => api.get<EnterpriseAnalytics>(`/api/v1/analytics/enterprise?days=${days}`),
  });
}

// practice-pulse is OpenAI-backed and currently 503s in production when the
// provider has no billing credits — treated as "no insights yet", not an error.
export function usePracticePulse() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["practice-pulse", clinicId],
    enabled: !!clinicId,
    retry: false,
    queryFn: async () => {
      try {
        const { insights } = await api.get<{ insights: string[] }>("/api/v1/analytics/practice-pulse");
        return insights;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 503 || err.status === 502)) return [];
        throw err;
      }
    },
  });
}
