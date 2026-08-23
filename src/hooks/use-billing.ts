"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { fromApiInvoice, type ApiInvoice } from "@/lib/adapters";
import { useSession } from "@/stores";

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
