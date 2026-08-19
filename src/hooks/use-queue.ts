"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiQueueItem, type AdaptedQueueItem, type ApiQueueItem } from "@/lib/adapters";
import { subscribeToQueue } from "@/lib/realtime";
import { useSession } from "@/stores";

export function activeQueue(queue: AdaptedQueueItem[]) {
  return queue.filter((q) => q.state !== "done");
}

export function useQueue() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["queue", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { queue } = await api.get<{ queue: ApiQueueItem[] }>("/api/v1/queue");
      return queue.map(fromApiQueueItem);
    },
    // Realtime pushes changes in; this is a slow safety-net poll in case a
    // websocket event is missed or Realtime isn't configured on the backend.
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!clinicId) return;
    return subscribeToQueue(clinicId, () => queryClient.invalidateQueries({ queryKey: ["queue", clinicId] }));
  }, [clinicId, queryClient]);

  return query;
}
