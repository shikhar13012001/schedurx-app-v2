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
    queryKey: ["appointments", clinicId, params.date ?? null, params.doctorId ?? null, null],
    enabled: !!clinicId,
    queryFn: async () => {
      const { appointments } = await api.get<{ appointments: ApiAppointment[] }>(`/api/v1/appointments${suffix}`);
      return appointments.map(fromApiAppointment);
    },
  });
}

// A patient's full appointment history (booked/completed/no_show/cancelled)
// for the profile page's "Appointment history" section — distinct from the
// Clinical timeline's Visit rows, which only cover completed clinical
// encounters that produced a note. A dedicated hook (not a thin call into
// useAppointments) so it can gate on patientId itself, rather than
// accidentally fetching every appointment in the clinic while patientId is
// still undefined mid-render.
export function usePatientAppointments(patientId: string | undefined) {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["appointments", clinicId, null, null, patientId ?? null],
    enabled: !!clinicId && !!patientId,
    queryFn: async () => {
      const { appointments } = await api.get<{ appointments: ApiAppointment[] }>(`/api/v1/appointments?patientId=${patientId}`);
      return appointments.map(fromApiAppointment);
    },
  });
}
