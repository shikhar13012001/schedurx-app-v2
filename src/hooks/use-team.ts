"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiDoctor, fromApiStaff, type ApiDoctor, type ApiStaff } from "@/lib/adapters";
import { useSession } from "@/stores";

export interface InviteDelivery {
  channel: "whatsapp" | "sms";
  status: string;
  providerMessageId: string | null;
  errorCode?: string | number | null;
}

export interface CreateInviteResult {
  invite: { id: string; phone: string; token: string; shortCode: string; status: string };
  delivery: InviteDelivery[];
}

export function useTeam() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["team", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { doctors, staff } = await api.get<{ doctors: ApiDoctor[]; staff: ApiStaff[] }>("/api/v1/team");
      return { doctors: doctors.map(fromApiDoctor), staff: staff.map(fromApiStaff) };
    },
  });
}

// Convenience: most pages only need the doctor list (mirrors mock.ts's DOCTORS).
export function useDoctors() {
  const team = useTeam();
  return { ...team, data: team.data?.doctors };
}

export function useCreateInvite() {
  return useMutation({
    mutationFn: (input: { name?: string; phone: string; role: "doctor" | "receptionist"; doctorId?: string }) =>
      api.post<CreateInviteResult>("/api/v1/team/invites", input),
  });
}

export function useUpdateDoctor() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ doctorId, patch }: { doctorId: string; patch: { feeInr?: number; slotDurationOverrideMins?: number; workingHoursStart?: string; workingHoursEnd?: string; bio?: string } }) => {
      const { doctor } = await api.patch<{ doctor: ApiDoctor }>(`/api/v1/doctors/${doctorId}`, patch);
      return fromApiDoctor(doctor);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team", clinicId] }),
  });
}
