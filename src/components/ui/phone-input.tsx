"use client";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

export function PhoneField({ value, onChange, error, placeholder = "98765 43210", autoFocus }: {
  value?: string; onChange: (v?: string) => void; error?: boolean; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative flex h-14 w-full items-center rounded-field border border-border/70 bg-surface-2/80 px-[18px] transition-[box-shadow,border-color,background-color] focus-within:border-primary/[0.45] focus-within:bg-surface focus-within:ring-4 focus-within:ring-primary/10", error && "border-danger/60")}>
      <PhoneInput international={false} defaultCountry="IN" value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} />
    </div>
  );
}
