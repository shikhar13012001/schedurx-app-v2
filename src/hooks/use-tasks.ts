"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiTask, type ApiTask } from "@/lib/adapters";
import { useSession } from "@/stores";

export function useTasks() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["tasks", clinicId],
    enabled: !!clinicId,
    // A task's "due now"/overdue state depends on the current time, not
    // just on data changing server-side — same reasoning use-queue.ts's
    // poll already documents for possible-no-shows. This is also what
    // drives the backend's notifyDueTasks safety net (GET /tasks triggers
    // it) — without a poll, a due task only ever got checked when someone
    // happened to open this page.
    refetchInterval: 30_000,
    queryFn: async () => {
      const { tasks } = await api.get<{ tasks: ApiTask[] }>("/api/v1/tasks");
      return tasks.map(fromApiTask);
    },
  });
}
