"use client";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AIControl({ state = "idle", size = 56, className, icon = true }: {
  state?: "idle" | "live" | "thinking"; size?: number; className?: string; icon?: boolean;
}) {
  return (
    <motion.span
      animate={state === "live" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={state === "live" ? { repeat: Infinity, duration: 1.8, ease: "easeInOut" } : { duration: .2 }}
      style={{ width: size, height: size }}
      className={cn("ai-control inline-flex items-center justify-center", state === "live" && "is-live", state === "thinking" && "is-thinking", className)}
    >
      {icon && <Sparkles size={Math.max(16, size * .32)} className="text-ink/75 dark:text-white/80" />}
    </motion.span>
  );
}
