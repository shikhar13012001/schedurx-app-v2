"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// No accordion primitive exists elsewhere in this app — this is deliberately
// plain (typography + spacing, one hairline divider) rather than a bordered
// settings-table row, per the design system's "flatten the hierarchy"
// principle. Values inside stay mounted while collapsed (no unmount), so
// nothing is lost switching sections.
export function ExpandableSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/60 py-4 first:pt-0 last:border-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pressable flex w-full items-center justify-between gap-4 text-left"
      >
        <span>
          <span className="block text-[15px] font-medium text-ink">{title}</span>
          {subtitle && <span className="mt-0.5 block text-[12.5px] text-muted">{subtitle}</span>}
        </span>
        <ChevronDown size={17} className={cn("shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
