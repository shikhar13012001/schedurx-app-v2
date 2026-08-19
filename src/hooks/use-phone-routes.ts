"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useSession } from "@/stores";

export interface PhoneRoute {
  id: string;
  clinicId: string;
  doctorId: string | null;
  originalNumber: string;
  twilioNumber: string | null;
  isActive: boolean;
}

export function usePhoneRoutes() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["phone-routes", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { routes } = await api.get<{ routes: PhoneRoute[] }>("/api/v1/phone-routes");
      return routes;
    },
  });
}

export function useCreatePhoneRoute() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { originalNumber: string; twilioNumber?: string; doctorId?: string }) =>
      api.post<{ route: PhoneRoute }>("/api/v1/phone-routes", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phone-routes", clinicId] }),
  });
}

export function useUpdatePhoneRoute() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<PhoneRoute, "originalNumber" | "twilioNumber" | "doctorId" | "isActive">> }) =>
      api.patch<{ route: PhoneRoute }>(`/api/v1/phone-routes/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phone-routes", clinicId] }),
  });
}

export function useDeletePhoneRoute() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/phone-routes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phone-routes", clinicId] }),
  });
}
