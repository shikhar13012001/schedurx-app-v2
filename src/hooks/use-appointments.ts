"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiAppointment, type ApiAppointment } from "@/lib/adapters";
import { useSession } from "@/stores";

export function useAppointments(params: { date?: string; doctorId?: string } = {}) {
  const clinicId = useSession((s) => s.session?.clinicId);
  const qs = new URLSearchParams();
  if (params.date) qs.set("date", params.date);
  if (params.doctorId) qs.set("doctorId", params.doctorId);
  const suffix = qs.toString() ? `?${qs}` : "";

  return useQuery({
    queryKey: ["appointments", clinicId, params.date ?? null, params.doctorId ?? null],
    enabled: !!clinicId,
    queryFn: async () => {
      const { appointments } = await api.get<{ appointments: ApiAppointment[] }>(`/api/v1/appointments${suffix}`);
      return appointments.map(fromApiAppointment);
    },
  });
}
