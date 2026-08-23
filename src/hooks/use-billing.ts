"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiInvoice, type ApiInvoice } from "@/lib/adapters";
import { useSession } from "@/stores";
import type { AddonCatalog } from "@/components/onboarding/plan-picker";

export function useInvoices(status?: "pending" | "paid" | "failed" | "refunded") {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["invoices", clinicId, status ?? null],
    enabled: !!clinicId,
    queryFn: async () => {
      const suffix = status ? `?status=${status}` : "";
      const { invoices } = await api.get<{ invoices: ApiInvoice[] }>(`/api/v1/billing/invoices${suffix}`);
      return invoices.map(fromApiInvoice);
    },
  });
}

// ScheduRx's own recurring subscription (what the clinic pays ScheduRx) —
// distinct from useInvoices() above, which is patient billing (what the
// clinic's patients pay the clinic). Owner-only route on the backend.
export type SubscriptionSummary = {
  plan: { planId: "basic" | "premium" | "custom"; addonIds: string[] } | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  addons: string[];
  hasStripeCustomer: boolean;
};

// Not gated on session.role: the frontend's Role type ("doctor" |
// "receptionist") can't actually express "owner" — login() collapses the
// backend's owner role into "doctor" (see onboarding/page.tsx's
// resolveExisting()), so there's no reliable client-side owner check to
// gate this on. The backend's requireRole("owner") is the real enforcement;
// a non-owner just gets a 403 here, which the caller treats as "nothing to
// show" rather than an error.
export function useSubscription() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["subscription", clinicId],
    enabled: !!clinicId,
    retry: false,
    queryFn: () => api.get<SubscriptionSummary>("/api/v1/billing/subscription"),
  });
}

// The addon price/name catalog — same one onboarding's plan picker reads,
// via the one endpoint that already exposes it (GET /api/v1/onboarding isn't
// gated on onboarding being incomplete, so this works fine post-onboarding
// too). No dedicated /billing endpoint for this alone since it's static
// catalog data, not billing state.
export function useAddonCatalog() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["addon-catalog"],
    enabled: !!clinicId,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { catalog } = await api.get<{ catalog: { addons: AddonCatalog } }>("/api/v1/onboarding");
      return catalog.addons;
    },
  });
}

// Add/remove one addon on the 'custom' plan's live subscription
// (POST /api/v1/billing/subscription/addons) — Stripe's Customer Portal
// can't express this (see stripe-subscription-service.js's file header), so
// this is the small custom API Phase 2 built specifically for it.
export function useUpdateSubscriptionAddon() {
  const clinicId = useSession((s) => s.session?.clinicId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ addonId, action }: { addonId: string; action: "add" | "remove" }) =>
      api.post<{ plan: SubscriptionSummary["plan"]; addons: string[] }>("/api/v1/billing/subscription/addons", { addonId, action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscription", clinicId] }),
  });
}
