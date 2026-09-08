"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiPatient, fromApiVisit, type ApiPatient, type ApiVisit } from "@/lib/adapters";
import { useSession } from "@/stores";
import type { Patient } from "@/lib/types";

export function usePatients(q = "") {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["patients", clinicId, q],
    enabled: !!clinicId,
    queryFn: async () => {
      const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
      const { patients } = await api.get<{ patients: ApiPatient[] }>(`/api/v1/patients${suffix}`);
      return patients.map((p) => fromApiPatient(p));
    },
  });
}

export function usePatient(id: string | undefined): { data: Patient | undefined; isLoading: boolean } {
  const clinicId = useSession((s) => s.session?.clinicId);
  const patientQuery = useQuery({
    queryKey: ["patient", clinicId, id],
    enabled: !!clinicId && !!id,
    queryFn: async () => {
      const { patient } = await api.get<{ patient: ApiPatient }>(`/api/v1/patients/${id}`);
      return patient;
    },
  });
  const visitsQuery = useQuery({
    queryKey: ["visits", clinicId, id],
    enabled: !!clinicId && !!id,
    queryFn: async () => {
      const { visits } = await api.get<{ visits: ApiVisit[] }>(`/api/v1/visits?patientId=${id}`);
      return visits.map(fromApiVisit);
    },
  });

  if (!patientQuery.data) return { data: undefined, isLoading: patientQuery.isLoading || visitsQuery.isLoading };
  return { data: fromApiPatient(patientQuery.data, visitsQuery.data ?? []), isLoading: false };
}

// Clears a captured lead's "missed_call" source, confirming it as a real
// patient record — the same effect a real booking already has automatically
// (see api-v1-public.js's POST /appointments), just as an explicit manual
// action for a captured caller who hasn't booked yet.
export function useConfirmPatient() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<{ patient: ApiPatient }>(`/api/v1/patients/${id}/confirm`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", clinicId] }),
  });
}
