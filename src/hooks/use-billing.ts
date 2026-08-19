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
