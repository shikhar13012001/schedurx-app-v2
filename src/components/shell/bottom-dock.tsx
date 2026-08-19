"use client";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Home, MessageCircleMore, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIControl } from "@/components/ui/ai-control";
import { useClinic } from "@/stores";

export const TAB_ORDER = ["/home", "/calendar", "/consults", "/patients"];

const TABS = [
  { href: "/home", icon: Home, label: "Home" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/consults", icon: MessageCircleMore, label: "Consults" },
  { href: "/patients", icon: Users, label: "Patients" },
];

export function BottomDock({ onSummonAI }: { onSummonAI: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const aiEnabled = useClinic((s) => s.settings.aiAssistant);

  const renderTab = (t: typeof TABS[number]) => {
    const active = pathname.startsWith(t.href);
    const Icon = t.icon;
    return (
      <button key={t.href} onClick={() => router.push(t.href)} className="pressable relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5" aria-label={t.label}>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-colors", active ? "bg-white text-ink" : "text-white/[0.62]")}>
          <Icon size={19} />
        </span>
        <span className={cn("text-[9.5px] font-medium", active ? "text-white" : "text-white/[0.46]")}>{t.label}</span>
      </button>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden" aria-label="Primary navigation">
      <div className="srx-dark-glass mx-auto flex h-[70px] max-w-[430px] items-stretch rounded-[30px] px-2 shadow-dock">
        {renderTab(TABS[0])}
        {renderTab(TABS[1])}
        <button onClick={onSummonAI} disabled={!aiEnabled} className="pressable relative flex w-[68px] shrink-0 items-center justify-center disabled:opacity-[0.45]" aria-label="Ask ScheduRx">
          <AIControl size={54} className="-mt-7" />
          <span className="absolute bottom-[5px] text-[9.5px] font-medium text-white/[0.56]">Ask</span>
        </button>
        {renderTab(TABS[2])}
        {renderTab(TABS[3])}
      </div>
    </nav>
  );
}
