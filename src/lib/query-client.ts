"use client";

import { QueryClient } from "@tanstack/react-query";

// Module-level singleton so both <Providers> and the Zustand store's
// server-mutating actions (which invalidate queries after a write) share the
// same cache instance.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
});
