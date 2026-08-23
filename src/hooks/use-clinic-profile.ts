"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useSession } from "@/stores";

export interface ClinicProfile {
  id: string;
  name: string;
  openingHour: number | null;
  closingHour: number | null;
  workingDays: string[] | null;
  googleReviewUrl: string | null;
}

export function useClinicProfile() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["clinic-profile", clinicId],
    enabled: !!clinicId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { clinic } = await api.get<{ clinic: ClinicProfile }>("/api/v1/clinic");
      return clinic;
    },
  });
}
