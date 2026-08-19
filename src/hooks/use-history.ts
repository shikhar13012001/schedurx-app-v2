"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiCallLog, fromApiWaLog, type ApiCallLog, type ApiWaLog } from "@/lib/adapters";
import { useSession } from "@/stores";

// Both endpoints are real but return empty lists in production today — the
// voice/WhatsApp agents don't write to CallLog/WaLog yet. Empty is correct,
// not a broken integration.
export function useCallLogs() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["call-logs", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { callLogs } = await api.get<{ callLogs: ApiCallLog[] }>("/api/v1/call-logs");
      return callLogs.map(fromApiCallLog);
    },
  });
}

export function useWaLogs() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["wa-logs", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { waLogs } = await api.get<{ waLogs: ApiWaLog[] }>("/api/v1/wa-logs");
      return waLogs.map(fromApiWaLog);
    },
  });
}
