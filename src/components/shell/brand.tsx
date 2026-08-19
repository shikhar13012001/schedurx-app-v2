import { cn } from "@/lib/utils";

export function Wordmark({ className, size = "md", inverse = false }: { className?: string; size?: "md" | "lg"; inverse?: boolean }) {
  return (
    <span className={cn("font-brand select-none font-light", inverse ? "text-white" : "text-ink", size === "lg" ? "text-[34px]" : "text-[23px]", className)}>
      Schedu<span className={inverse ? "text-white" : "text-primary"}>Rx</span>
    </span>
  );
}
