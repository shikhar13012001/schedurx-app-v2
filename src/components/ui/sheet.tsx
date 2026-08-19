"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({ open, onOpenChange, side = "bottom", title, children, className }: {
  open: boolean; onOpenChange: (o: boolean) => void; side?: "bottom" | "right";
  title?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-[#181818]/30 backdrop-blur-[4px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()}>
              <motion.div
                className={cn(
                  "fixed z-50 bg-surface/95 text-ink shadow-float backdrop-blur-2xl focus:outline-none",
                  side === "bottom"
                    ? "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[38px] md:inset-x-auto md:left-1/2 md:w-[560px] md:-translate-x-1/2 md:rounded-[38px] md:bottom-5"
                    : "inset-y-4 right-4 h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md rounded-[38px]",
                  className
                )}
                initial={side === "bottom" ? { y: "100%", opacity: .5 } : { x: "105%", opacity: .5 }}
                animate={side === "bottom" ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
                exit={side === "bottom" ? { y: "100%", opacity: .5 } : { x: "105%", opacity: .5 }}
                transition={{ type: "spring", damping: 30, stiffness: 245, mass: .9 }}
              >
                {side === "bottom" && <div className="mx-auto mt-3 h-1 w-10 rounded-pill bg-stone/[0.45]" />}
                <div className="flex items-center justify-between px-6 pb-2 pt-4">
                  <Dialog.Title className="font-display text-[28px] font-light leading-none tracking-[-0.05em]">{title}</Dialog.Title>
                  <Dialog.Close className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted" aria-label="Close"><X size={18} /></Dialog.Close>
                </div>
                <div className="max-h-[calc(94dvh-82px)] overflow-y-auto px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-3">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
