"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiChatMsg, fromApiThread, type AdaptedThread, type ApiChatMsg, type ApiThread } from "@/lib/adapters";
import { useSession } from "@/stores";

export function useThreads(status?: "open" | "escalated" | "closed") {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["threads", clinicId, status ?? null],
    enabled: !!clinicId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const suffix = status ? `?status=${status}` : "";
      const { threads } = await api.get<{ threads: ApiThread[] }>(`/api/v1/threads${suffix}`);
      return threads.map((t) => fromApiThread(t));
    },
  });
}

export function useThread(id: string | undefined): { data: AdaptedThread | undefined; isLoading: boolean } {
  const clinicId = useSession((s) => s.session?.clinicId);
  const threads = useThreads();
  const messagesQuery = useQuery({
    queryKey: ["thread-messages", clinicId, id],
    enabled: !!clinicId && !!id,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { messages } = await api.get<{ messages: ApiChatMsg[] }>(`/api/v1/threads/${id}/messages`);
      return messages.map(fromApiChatMsg);
    },
  });

  const base = threads.data?.find((t) => t.id === id);
  if (!base) return { data: undefined, isLoading: threads.isLoading || messagesQuery.isLoading };
  return { data: { ...base, messages: messagesQuery.data ?? [] }, isLoading: false };
}

// Resolves (or opens) the consult thread for a patient — used by the
// "message this patient" button on their profile so it navigates to a real
// thread instead of just toasting.
export function useFindOrCreateThread() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patientId: string) => {
      const { thread } = await api.post<{ thread: ApiThread }>("/api/v1/threads/find-or-create", { patientId });
      return thread;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["threads", clinicId] }),
  });
}
