"use client";

import { useState } from "react";
import { Banknote, CreditCard, Lock, ReceiptText, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useInvoices } from "@/hooks/use-billing";
import { usePatients } from "@/hooks/use-patients";
import { useFindOrCreateThread } from "@/hooks/use-threads";
import { useClinic, useSession } from "@/stores";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { inr, fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const MODE_ICON = { upi: Smartphone, cash: Banknote, card: CreditCard } as const;

export default function BillingPage() {
  const { settings, reply } = useClinic();
  const role = useSession((s) => s.session?.role);
  const { data: invoices = [] } = useInvoices();
  const { data: patients } = usePatients();
  const findOrCreateThread = useFindOrCreateThread();
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (!settings.billing) {
    return (
      <div className="mx-auto max-w-2xl pt-8">
        <Empty icon={Lock} title="Billing is switched off" body={role === "doctor" ? "Turn it on from Profile → Practice to track payments and invoices." : "The doctor hasn’t enabled billing for this clinic yet."} />
      </div>
    );
  }

  const collected = invoices.filter((invoice) => invoice.state === "paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const due = invoices.filter((invoice) => invoice.state === "due").reduce((sum, invoice) => sum + invoice.amount, 0);
  const pct = collected + due ? Math.round((collected / (collected + due)) * 100) : 0;

  const sendInvoice = async (invoiceId: string, patientId: string, patientName: string | undefined, amount: number, state: string) => {
    setSendingId(invoiceId);
    try {
      const thread = await findOrCreateThread.mutateAsync(patientId);
      const body = state === "paid"
        ? `Hi, this confirms we received your payment of ${inr(amount)}. Thank you!`
        : `Hi, you have a pending payment of ${inr(amount)}. Please pay at your convenience.`;
      await reply(thread.id, body);
      toast.success(`Invoice sent to ${patientName ?? "patient"} on WhatsApp`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send that invoice.");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="stagger mx-auto max-w-2xl space-y-8">
      <header>
        <p className="text-[12px] text-muted">Practice money</p>
        <h1 className="mt-1 font-display text-[clamp(3rem,12vw,4.4rem)] font-light leading-[0.94] tracking-[-0.055em]">Billing</h1>
      </header>

      <section className="atmosphere atmosphere-orange-right relative overflow-hidden rounded-hero bg-stone px-5 py-7 text-charcoal shadow-float dark:text-white sm:px-7">
        <div className="relative z-10">
          <p className="text-[12px] text-charcoal/[0.68] dark:text-white/[0.68]">Collected this month</p>
          <p className="mt-4 font-display text-[clamp(3.8rem,17vw,6.3rem)] font-light leading-[0.82] tracking-[-0.065em] tabular-nums">{inr(collected)}</p>
          <div className="mt-8 h-[2px] bg-charcoal/[0.22] dark:bg-white/[0.22]"><div className="h-full bg-charcoal dark:bg-white" style={{ width: `${pct}%` }} /></div>
          <div className="mt-3 flex justify-between text-[11.5px] text-charcoal/[0.68] dark:text-white/[0.68]"><span>Due {inr(due)}</span><span>{pct}% collected</span></div>
        </div>
      </section>

      <section>
        <div className="mb-4"><p className="text-[12px] text-muted">Invoice activity</p><h2 className="mt-1 font-display text-[29px] font-light tracking-[-0.045em]">Recent payments</h2></div>
        <div className="overflow-hidden rounded-panel bg-surface px-2 shadow-card">
          {invoices.map((invoice, index) => {
            const patient = patients?.find((item) => item.id === invoice.patientId);
            const ModeIcon = MODE_ICON[invoice.mode];
            return (
              <div key={invoice.id} className={cn("flex min-h-[82px] items-center gap-3 px-2 py-3", index !== invoices.length - 1 && "border-b border-border/60")}>
                <Avatar id={invoice.patientId} name={patient?.name ?? "Patient"} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{patient?.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted"><ModeIcon size={11} /> {invoice.mode.toUpperCase()} · {fmtDate(invoice.at)} · {invoice.state === "paid" ? "Paid" : "Due"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-medium tabular-nums">{inr(invoice.amount)}</p>
                  <button
                    onClick={() => sendInvoice(invoice.id, invoice.patientId, patient?.name, invoice.amount, invoice.state)}
                    disabled={sendingId === invoice.id}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted disabled:opacity-50"
                  >
                    Send <Share2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex min-h-[78px] items-center gap-3 rounded-panel bg-surface-soft px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-card"><ReceiptText size={16} /></span>
        <span><span className="block text-[14px] font-medium">Settlement & GST</span><span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">UPI links, GST invoices and end-of-day settlement live here with the payments integration.</span></span>
      </section>
    </div>
  );
}
