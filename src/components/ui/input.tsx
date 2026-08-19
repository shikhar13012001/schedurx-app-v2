import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-14 w-full rounded-field border border-border/70 bg-surface-2/80 px-[18px] text-[15px] text-ink placeholder:text-faint",
        "transition-[box-shadow,border-color,background-color] focus:border-primary/[0.45] focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/10",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[112px] w-full rounded-field border border-border/70 bg-surface-2/80 px-[18px] py-4 text-[15px] leading-relaxed text-ink placeholder:text-faint",
        "transition-[box-shadow,border-color,background-color] focus:border-primary/[0.45] focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/10",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Field({ label, error, children, hint }: { label?: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      {label && <span className="text-[13px] font-normal text-muted">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-faint">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}
