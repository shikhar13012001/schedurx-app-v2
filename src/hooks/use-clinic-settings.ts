"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiClinicSettings } from "@/lib/adapters";
import { useClinic, useSession, type Settings } from "@/stores";

// Settings render synchronously from the Zustand store everywhere in the app
// (existing components read useClinic(s => s.settings)), but the backend is
// the source of truth — this hook fetches once per session and hydrates the
// store. Mount it once, near the app shell root.
export function useSyncClinicSettings() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const hydrateSettings = useClinic((s) => s.hydrateSettings);

  const query = useQuery({
    queryKey: ["clinic-settings", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { settings } = await api.get<{ settings: Partial<Settings> }>("/api/v1/clinic-settings");
      return fromApiClinicSettings(settings);
    },
  });

  useEffect(() => {
    if (query.data) hydrateSettings(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  return query;
}
