"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  fromApiQueueItem, fromApiPossibleNoShow,
  type AdaptedQueueItem, type ApiQueueItem, type PossibleNoShow, type ApiPossibleNoShow,
} from "@/lib/adapters";
import { subscribeToQueue } from "@/lib/realtime";
import { useSession } from "@/stores";

export function activeQueue(queue: AdaptedQueueItem[]) {
  return queue.filter((q) => q.state !== "done");
}

// Both hooks below read from the same query (same key + queryFn) — react-query
// dedupes that into one actual fetch, so useQueue()+usePossibleNoShows() used
// together on one screen (see queue.tsx) cost a single GET /api/v1/queue, not two.
function useQueueQuery() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["queue", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { queue, possibleNoShows } = await api.get<{ queue: ApiQueueItem[]; possibleNoShows: ApiPossibleNoShow[] }>("/api/v1/queue");
      return { queue: queue.map(fromApiQueueItem), possibleNoShows: possibleNoShows.map(fromApiPossibleNoShow) };
    },
    // Realtime pushes changes in; this is a slow safety-net poll in case a
    // websocket event is missed or Realtime isn't configured on the backend.
    // Also what re-derives "possible no-show" as wall-clock time passes —
    // that list depends on the current time, not just on data changing.
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!clinicId) return;
    return subscribeToQueue(clinicId, () => queryClient.invalidateQueries({ queryKey: ["queue", clinicId] }));
  }, [clinicId, queryClient]);

  return query;
}

export function useQueue(): { data: AdaptedQueueItem[] | undefined; isLoading: boolean } {
  const { data, isLoading } = useQueueQuery();
  return { data: data?.queue, isLoading };
}

export function usePossibleNoShows(): { data: PossibleNoShow[] | undefined; isLoading: boolean } {
  const { data, isLoading } = useQueueQuery();
  return { data: data?.possibleNoShows, isLoading };
}
