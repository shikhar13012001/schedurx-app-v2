"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function Segmented<T extends string>({ options, value, onChange, className }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  const layoutKey = `seg-${options.map((x) => x.value).join("-")}`;
  return (
    <div className={cn("inline-flex rounded-pill bg-surface-2 p-1.5", className)}>
      {options.map((o) => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)} className={cn("relative min-h-9 rounded-pill px-4 py-1.5 text-[13px] font-medium transition-colors", value === o.value ? "text-ink" : "text-muted")}>
          {value === o.value && <motion.span layoutId={layoutKey} className="absolute inset-0 rounded-pill bg-surface shadow-card" transition={{ type: "spring", bounce: 0.12, duration: 0.42 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
