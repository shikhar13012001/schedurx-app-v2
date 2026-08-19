"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pressable inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-[0.45] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-float hover:brightness-[0.98]",
        secondary: "bg-ink text-white hover:opacity-90 dark:bg-surface-3",
        outline: "border border-border/80 bg-surface text-ink hover:bg-surface-2",
        ghost: "text-ink hover:bg-surface-2",
        soft: "bg-surface-2 text-ink hover:bg-surface-3",
        orangeSoft: "bg-primary-soft text-primary-ink hover:bg-primary-soft/75",
        danger: "bg-danger-soft text-danger hover:bg-danger-soft/75",
        link: "min-h-0 rounded-none p-0 text-primary-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-10 min-h-10 px-4 text-[13px]",
        md: "h-12 px-5",
        lg: "h-14 px-6 text-[15px]",
        icon: "h-12 w-12 min-h-12 px-0",
        iconSm: "h-11 w-11 min-h-11 px-0",
        iconLg: "h-14 w-14 min-h-14 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
