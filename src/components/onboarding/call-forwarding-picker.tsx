"use client";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export type Carrier = "jio" | "airtel" | "other";
type CarrierMeta = { id: string; name: string; manualPath: string };

export function CallForwardingPicker({
  carriers,
  carrier,
  onCarrierChange,
  dialCode,
}: {
  carriers: Record<string, CarrierMeta>;
  carrier: Carrier | null;
  onCarrierChange: (c: Carrier) => void;
  dialCode: { dialString: string; telUri: string } | null;
}) {
  const meta = carrier && carrier !== "other" ? carriers[carrier] : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        {([
          { v: "jio", label: "Jio" },
          { v: "airtel", label: "Airtel" },
          { v: "other", label: "Other" },
        ] as const).map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => onCarrierChange(c.v)}
            className={cn(
              "pressable h-14 rounded-panel text-[14px] font-medium shadow-card transition-colors",
              carrier === c.v ? "bg-charcoal text-white" : "bg-surface hover:bg-surface-soft",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {carrier && carrier !== "other" && (
        <div className="rounded-panel bg-surface p-5 shadow-card">
          <p className="text-[14px] font-medium text-ink">Forward when unanswered</p>
          <p className="mt-1 text-[13px] text-muted">Your team still gets the first chance to answer — ScheduRx only takes over if nobody picks up.</p>

          {dialCode ? (
            <a
              href={dialCode.telUri}
              className="pressable mt-5 flex h-14 items-center justify-center gap-2.5 rounded-pill bg-primary text-[14px] font-medium text-primary-fg"
            >
              <Phone size={16} /> Open Phone to set up forwarding
            </a>
          ) : (
            <p className="mt-4 text-[13px] text-faint">On your phone, tap below and press Call to enable forwarding.</p>
          )}
          <p className="mt-3 text-center text-[12px] text-faint">You&rsquo;ll still need to press Call yourself — nothing dials automatically.</p>

          <p className="mt-5 text-[12px] text-faint">
            Prefer to do it manually? {meta?.manualPath}
          </p>
        </div>
      )}

      {carrier === "other" && (
        <div className="rounded-panel bg-surface-2/70 p-5">
          <p className="text-[13px] leading-relaxed text-muted">
            Open your phone&rsquo;s call settings and look for &ldquo;Call forwarding&rdquo; → &ldquo;When unanswered&rdquo;. Your carrier app usually has the same option too.
          </p>
        </div>
      )}
    </div>
  );
}
