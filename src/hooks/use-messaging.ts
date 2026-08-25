"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useSession } from "@/stores";

export interface MessageFailure {
  id: string;
  clinicId: string | null;
  providerSid: string;
  channel: "sms" | "whatsapp";
  toPhone: string | null;
  purpose: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetryQueueItem {
  id: string;
  clinicId: string | null;
  channel: "sms" | "whatsapp";
  toPhone: string;
  purpose: string | null;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "retrying" | "resolved" | "exhausted";
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
}

// Real Twilio delivery outcomes (undelivered/failed) for this clinic — see
// api-v1-messaging.js. Refetches on an interval rather than only on mount:
// this section exists specifically so staff notice a problem without
// having to remember to reopen the page.
export function useMessageFailures(sinceMinutes = 1440) {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["message-failures", clinicId, sinceMinutes],
    enabled: !!clinicId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { failures } = await api.get<{ failures: MessageFailure[] }>(`/api/v1/messaging/failures?sinceMinutes=${sinceMinutes}`);
      return failures;
    },
  });
}

export function useRetryQueue(status?: RetryQueueItem["status"]) {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["retry-queue", clinicId, status],
    enabled: !!clinicId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const qs = status ? `?status=${status}` : "";
      const { queue } = await api.get<{ queue: RetryQueueItem[] }>(`/api/v1/messaging/retry-queue${qs}`);
      return queue;
    },
  });
}
