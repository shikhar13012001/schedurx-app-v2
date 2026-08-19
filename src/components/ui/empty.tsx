import { LucideIcon } from "lucide-react";

export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start justify-center rounded-panel bg-surface-2/[0.65] px-6 py-9 text-left">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted shadow-card"><Icon size={20} /></div>
      <p className="font-display text-[26px] font-light leading-[1.02] tracking-[-0.05em]">{title}</p>
      {body && <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
