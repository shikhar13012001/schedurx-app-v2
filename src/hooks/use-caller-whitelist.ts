"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useSession } from "@/stores";
import { nativeMissedCall } from "@/lib/native-missed-call";

export interface CallerWhitelistEntry {
  id: string;
  clinicId: string;
  phone: string;
  label: string | null;
  addedByStaffId: string | null;
  createdAt: string;
}

export function useCallerWhitelist() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const query = useQuery({
    queryKey: ["caller-whitelist", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { whitelist } = await api.get<{ whitelist: CallerWhitelistEntry[] }>("/api/v1/caller-whitelist");
      return whitelist;
    },
  });

  // Piggy-backs on this fetch to refresh the native plugin's local cache
  // (see MissedCallReceiver.kt) — no separate network round trip on the
  // native side just to stay in sync. A no-op outside the Capacitor shell.
  useEffect(() => {
    if (query.data) void nativeMissedCall.syncWhitelist(query.data.map((e) => e.phone));
  }, [query.data]);

  return query;
}

export function useAddCallerWhitelist() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { phone: string; label?: string }) =>
      api.post<{ entry: CallerWhitelistEntry }>("/api/v1/caller-whitelist", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["caller-whitelist", clinicId] }),
  });
}

export function useRemoveCallerWhitelist() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/caller-whitelist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["caller-whitelist", clinicId] }),
  });
}
