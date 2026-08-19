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
    queryFn: async () => {
      const { tasks } = await api.get<{ tasks: ApiTask[] }>("/api/v1/tasks");
      return tasks.map(fromApiTask);
    },
  });
}
