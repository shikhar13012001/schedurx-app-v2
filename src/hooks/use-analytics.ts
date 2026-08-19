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
      const { daily, totals } = await api.get<{
        daily: ApiDayStat[];
        totals: { appointments: number; revenue: number; cancellations: number };
      }>(`/api/v1/analytics/summary?days=${days}`);
      return { daily: daily.map(fromApiDayStat), totals };
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
