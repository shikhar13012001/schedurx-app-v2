"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanId = "basic" | "premium" | "custom";
export type PlanCatalog = Record<PlanId, { id: PlanId; name: string; tagline: string; monthlyPaise?: number; basePaise?: number; recommended?: boolean; includedCreditsPerMonth?: number }>;
export type AddonCatalog = Record<string, { id: string; name: string; monthlyPaise: number; usageBased?: boolean; perDoctor?: boolean }>;

function inr(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

const PLAN_FEATURES: Record<PlanId, string[]> = {
  basic: ["Website & booking page", "Full scheduling & patient records", "Structured WhatsApp booking", "Missed-call safety net", "Voice notes"],
  premium: ["Everything in Core", "AI phone receptionist", "Conversational AI WhatsApp", "Ambient clinical listening", "AI reminders & follow-ups"],
  custom: ["Core platform included", "Add only what you need", "Pay for AI usage as you go"],
};

export function PlanPicker({
  plans,
  addons,
  selected,
  onSelect,
  addonIds,
  onAddonsChange,
}: {
  plans: PlanCatalog;
  addons: AddonCatalog;
  selected: PlanId | null;
  onSelect: (id: PlanId) => void;
  addonIds: string[];
  onAddonsChange: (ids: string[]) => void;
}) {
  const toggleAddon = (id: string) => {
    onAddonsChange(addonIds.includes(id) ? addonIds.filter((a) => a !== id) : [...addonIds, id]);
  };

  const customTotal = plans.custom.basePaise! + addonIds.reduce((sum, id) => sum + (addons[id]?.monthlyPaise ?? 0), 0);

  return (
    <div className="space-y-3">
      {(Object.values(plans) as PlanCatalog[PlanId][]).map((plan) => {
        const isSelected = selected === plan.id;
        return (
          <div key={plan.id}>
            <button
              type="button"
              onClick={() => onSelect(plan.id)}
              className={cn(
                "pressable w-full rounded-panel p-5 text-left shadow-card transition-all",
                isSelected ? "bg-charcoal text-white" : "bg-surface hover:bg-surface-soft",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[17px] font-medium">{plan.name}</p>
                    {plan.recommended && (
                      <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", isSelected ? "bg-primary text-primary-fg" : "bg-primary-soft text-primary-ink")}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-1 text-[13px]", isSelected ? "text-white/60" : "text-muted")}>{plan.tagline}</p>
                </div>
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", isSelected ? "border-primary bg-primary text-primary-fg" : "border-border/70")}>
                  {isSelected && <Check size={13} />}
                </span>
              </div>

              <p className="mt-4 text-[22px] font-light">
                {plan.id === "custom" ? inr(plans.custom.basePaise!) : inr(plan.monthlyPaise!)}
                <span className={cn("text-[13px] font-normal", isSelected ? "text-white/50" : "text-faint")}> /month{plan.id === "custom" ? " base" : ""}</span>
              </p>

              <ul className="mt-4 space-y-1.5">
                {PLAN_FEATURES[plan.id].map((f) => (
                  <li key={f} className={cn("flex items-center gap-2 text-[13px]", isSelected ? "text-white/75" : "text-muted")}>
                    <span className={cn("h-1 w-1 rounded-full", isSelected ? "bg-primary" : "bg-faint")} />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.includedCreditsPerMonth && (
                <p className={cn("mt-4 text-[12.5px]", isSelected ? "text-primary" : "text-primary-ink")}>
                  {plan.includedCreditsPerMonth.toLocaleString("en-IN")} ScheduRx Credits included/month
                </p>
              )}
            </button>

            {isSelected && plan.id === "custom" && (
              <div className="mt-2 space-y-2 rounded-panel bg-surface p-4 shadow-card">
                {(Object.values(addons) as AddonCatalog[string][]).map((addon) => {
                  const on = addonIds.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddon(addon.id)}
                      className={cn("pressable flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left transition-colors", on ? "bg-surface-2" : "hover:bg-surface-2/60")}
                    >
                      <span>
                        <span className="block text-[14px] font-medium text-ink">{addon.name}</span>
                        <span className="block text-[12px] text-faint">
                          {inr(addon.monthlyPaise)}/month{addon.usageBased ? " + usage" : ""}
                          {addon.perDoctor ? " per doctor" : ""}
                        </span>
                      </span>
                      <span className={cn("flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors", on ? "bg-primary" : "bg-surface-3")}>
                        <span className={cn("h-5 w-5 rounded-full bg-white shadow-card transition-transform", on && "translate-x-5")} />
                      </span>
                    </button>
                  );
                })}
                <div className="flex items-center justify-between rounded-field bg-surface-2/70 px-4 py-3">
                  <span className="text-[13px] text-muted">Estimated monthly</span>
                  <span className="text-[15px] font-medium text-ink">{inr(customTotal)}<span className="text-[12px] font-normal text-faint"> + usage</span></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <p className="pt-1 text-center text-[12px] text-faint">Usage-based AI and communication charges use ScheduRx Credits, billed separately.</p>
    </div>
  );
}
