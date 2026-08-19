"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root className={cn("peer inline-flex h-[30px] w-[52px] shrink-0 cursor-pointer items-center rounded-pill border border-transparent bg-surface-3 transition-colors data-[state=checked]:bg-primary", className)} {...props}>
      <SwitchPrimitive.Thumb className="pointer-events-none block h-6 w-6 translate-x-[3px] rounded-full bg-white shadow-card transition-transform data-[state=checked]:translate-x-[25px]" />
    </SwitchPrimitive.Root>
  );
}
