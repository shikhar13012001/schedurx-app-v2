"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Bell, CalendarDays, CircleUserRound, History, Home, ListTodo, Menu,
  MessageCircleMore, ReceiptIndianRupee, Sparkles, Users, UsersRound, Workflow, X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Wordmark } from "@/components/shell/brand";
import { BottomDock, TAB_ORDER } from "@/components/shell/bottom-dock";
import { AiSheet } from "@/components/shell/ai-sheet";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { AIControl } from "@/components/ui/ai-control";
import { useClinic, useSession } from "@/stores";
import { useNotifications, useNotificationToasts } from "@/hooks/use-notifications";
import { useSyncClinicSettings } from "@/hooks/use-clinic-settings";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/home", icon: Home, label: "Home" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/consults", icon: MessageCircleMore, label: "Consults" },
  { href: "/patients", icon: Users, label: "Patients" },
  { href: "/analytics", icon: BarChart3, label: "Analytics", doctorish: true },
  { href: "/tasks", icon: ListTodo, label: "Tasks" },
  { href: "/team", icon: UsersRound, label: "Team" },
  { href: "/history", icon: History, label: "AI activity" },
  { href: "/billing", icon: ReceiptIndianRupee, label: "Billing" },
  // Writes are owner-only server-side (requireRole("owner")) — the frontend
  // can't currently tell an owner apart from a regular doctor (both map to
  // role "doctor" at login), so any doctor sees this and a non-owner who
  // tries to save gets the same 403 toast Profile already shows for other
  // owner-only settings. ownerOnly (unlike doctorish) is never overridden by
  // receptionAnalytics — that toggle is specifically about Analytics.
  { href: "/automations", icon: Workflow, label: "Automations", ownerOnly: true },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/profile", icon: CircleUserRound, label: "Profile" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, hydrated, onboarded } = useSession();
  const { data: notifs } = useNotifications();
  const unread = notifs?.filter((n) => !n.read).length ?? 0;
  const unreadLabel = unread > 9 ? "9+" : String(unread);
  useNotificationToasts(notifs);
  const receptionAnalytics = useClinic((s) => s.settings.receptionAnalytics);
  const aiEnabled = useClinic((s) => s.settings.aiAssistant);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useSyncClinicSettings();

  useEffect(() => {
    if (!hydrated) return;
    if (!session) return void router.replace("/");
    // A session can exist but be mid-onboarding — someone who left the flow
    // partway through and reloaded, or navigated straight to an (app) URL.
    // /onboarding itself resolves exactly where they left off.
    if (!onboarded) router.replace("/onboarding");
  }, [hydrated, session, onboarded, router]);
  useEffect(() => {
    const openAI = () => { if (aiEnabled) setAiOpen(true); };
    window.addEventListener("srx-ai-open", openAI);
    return () => window.removeEventListener("srx-ai-open", openAI);
  }, [aiEnabled]);

  // Ambient capture keeps its transcript-so-far in local component state,
  // tied to the Home page — an accidental swipe to another tab mid-consult
  // would unmount it and silently lose everything captured. now-serving.tsx
  // broadcasts this whenever a session opens/closes; while one's open, a
  // swipe that starts anywhere on the page (not just on the capture card
  // itself, which data-noswipe already covers) is ignored instead of
  // navigating away.
  const captureActive = useRef(false);
  useEffect(() => {
    const onCapture = (e: Event) => { captureActive.current = Boolean((e as CustomEvent<boolean>).detail); };
    window.addEventListener("srx-capture-active", onCapture);
    return () => window.removeEventListener("srx-capture-active", onCapture);
  }, []);

  const [dragX, setDragX] = useState(0);
  const [navDir, setNavDir] = useState(0);
  const touch = useRef<{ x: number; y: number; block: boolean; locked: null | "h" | "v" } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    const blocked = captureActive.current || (e.target as HTMLElement).closest("[data-noswipe]") != null;
    touch.current = { x: t.clientX, y: t.clientY, block: blocked, locked: null };
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const st = touch.current; if (!st || st.block) return;
    const t = e.touches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (!st.locked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      st.locked = Math.abs(dx) > Math.abs(dy) * 1.25 ? "h" : "v";
    }
    if (st.locked !== "h") return;
    const idx = TAB_ORDER.findIndex((p) => pathname.startsWith(p));
    if (idx === -1) return;
    const atStart = idx === 0 && dx > 0, atEnd = idx === TAB_ORDER.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx * .22 : dx * .72);
  }, [pathname]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const st = touch.current; touch.current = null;
    if (!st || st.block || st.locked !== "h") { setDragX(0); return; }
    const dx = e.changedTouches[0].clientX - st.x;
    const idx = TAB_ORDER.findIndex((p) => pathname.startsWith(p));
    const w = typeof window !== "undefined" ? window.innerWidth : 390;
    const next = idx !== -1 ? TAB_ORDER[idx + (dx < 0 ? 1 : -1)] : undefined;
    if (Math.abs(dx) > w * .3 && next) {
      setNavDir(dx < 0 ? -1 : 1);
      router.push(next);
    }
    setDragX(0);
  }, [pathname, router]);

  if (!hydrated || !session) return <div className="min-h-dvh bg-bg" />;
  const visibleSections = SECTIONS.filter((s) => {
    if (s.doctorish && session.role === "receptionist" && !receptionAnalytics) return false;
    if (s.ownerOnly && session.role === "receptionist") return false;
    return true;
  });
  const detailMode = /^\/(?:consults|patients)\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-dvh bg-bg md:p-4">
      <aside className="srx-glass fixed inset-y-4 left-4 z-40 hidden w-[238px] flex-col rounded-[34px] p-4 md:flex">
        <div className="flex items-center justify-between px-2 pt-2">
          <Wordmark size="lg" />
          <ThemeToggle className="h-9 w-9 bg-surface/70 shadow-none" />
        </div>
        <p className="mt-1 px-2 text-[12px] text-muted">{session.clinicName}</p>

        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleSections.map((s) => {
            const active = pathname.startsWith(s.href);
            return (
              <Link key={s.href} href={s.href} className={cn("pressable flex min-h-11 items-center gap-3 rounded-[18px] px-3 text-[13.5px] transition-colors", active ? "bg-ink text-white dark:bg-surface-3" : "text-muted hover:bg-surface/70 hover:text-ink")}>
                <s.icon size={17} />
                <span className="flex-1">{s.label}</span>
                {s.href === "/notifications" && unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] text-white">{unreadLabel}</span>}
              </Link>
            );
          })}
        </nav>

        <button disabled={!aiEnabled} onClick={() => aiEnabled && setAiOpen(true)} className="pressable mt-4 flex items-center gap-3 rounded-[24px] bg-surface/70 p-3 text-left disabled:opacity-[0.45]">
          <AIControl size={46} />
          <span><span className="block text-[13px] font-medium">Ask ScheduRx</span><span className="block text-[11px] text-muted">{aiEnabled ? "Clinic operating layer" : "Assistant is off"}</span></span>
        </button>
        <button onClick={() => router.push("/profile")} className="pressable mt-3 flex items-center gap-3 rounded-[22px] px-2 py-2 hover:bg-surface/70">
          <Avatar id={session.email} name={session.name} size={38} />
          <span className="min-w-0 flex-1 text-left"><span className="block truncate text-[13px] font-medium">{session.name}</span><span className="block truncate text-[11px] text-muted">{session.role === "doctor" ? "Doctor" : "Front desk"}</span></span>
        </button>
      </aside>

      <div className="mx-auto w-full max-w-[460px] md:ml-[258px] md:mr-0 md:w-[calc(100%-258px)] md:max-w-none">
        <header className={cn("flex items-center justify-between px-5 pb-1 pt-[max(16px,env(safe-area-inset-top))] md:hidden", detailMode && "hidden")}>
          <button onClick={() => router.push("/profile")} className="pressable rounded-full" aria-label="Profile"><Avatar id={session.email} name={session.name} size={42} /></button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => router.push("/notifications")} className="pressable relative flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-medium leading-none text-white ring-2 ring-surface">{unreadLabel}</span>}
            </button>
            <button onClick={() => setMenuOpen(true)} className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card" aria-label="All sections"><Menu size={18} /></button>
          </div>
        </header>

        <main className={cn("mx-auto max-w-[1480px] overflow-x-hidden px-5 md:px-8 md:pb-12 md:pt-5 lg:px-10", detailMode ? "pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]" : "pb-[calc(108px+env(safe-area-inset-bottom))] pt-4")} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <AnimatePresence mode="popLayout" initial={false} custom={navDir}>
            <motion.div key={pathname} custom={navDir} initial={{ x: navDir === 0 ? 0 : navDir * -42, opacity: navDir === 0 ? 1 : 0 }} animate={{ x: dragX, opacity: 1 }} exit={{ x: navDir * 36, opacity: 0 }} transition={dragX !== 0 ? { type: "tween", duration: 0 } : { type: "spring", stiffness: 300, damping: 34 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {!detailMode && <BottomDock onSummonAI={() => setAiOpen(true)} />}
      <AiSheet open={aiOpen && aiEnabled} onOpenChange={setAiOpen} />

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-[#181818]/28 backdrop-blur-[3px] md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.aside className="fixed bottom-3 left-3 top-3 z-50 flex w-[calc(100%-24px)] max-w-[340px] flex-col rounded-[38px] bg-surface/[0.96] p-5 shadow-float backdrop-blur-2xl md:hidden" initial={{ x: "-105%", opacity: .5 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "-105%", opacity: .5 }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
              <div className="flex items-center justify-between">
                <Wordmark size="lg" />
                <button onClick={() => setMenuOpen(false)} className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted" aria-label="Close menu"><X size={18} /></button>
              </div>
              <div className="mt-7 flex items-center gap-3 rounded-[26px] bg-surface-2/75 p-3">
                <Avatar id={session.email} name={session.name} size={44} />
                <div className="min-w-0"><p className="truncate text-[14px] font-medium">{session.name}</p><p className="truncate text-[12px] text-muted">{session.clinicName} · {session.role === "doctor" ? "Doctor" : "Front desk"}</p></div>
              </div>
              <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
                {visibleSections.map((s) => {
                  const active = pathname.startsWith(s.href);
                  return (
                    <Link key={s.href} href={s.href} onClick={() => setMenuOpen(false)} className={cn("pressable flex min-h-12 items-center gap-3 rounded-[20px] px-3.5 text-[14px]", active ? "bg-ink text-white dark:bg-surface-3" : "text-ink hover:bg-surface-2")}>
                      <s.icon size={18} className={active ? "" : "text-muted"} />{s.label}
                      {s.href === "/notifications" && unread > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] text-white">{unreadLabel}</span>}
                    </Link>
                  );
                })}
              </nav>
              <button disabled={!aiEnabled} onClick={() => { if (!aiEnabled) return; setMenuOpen(false); setAiOpen(true); }} className="pressable mt-4 flex min-h-14 items-center gap-3 rounded-[24px] bg-primary px-4 text-charcoal disabled:bg-surface-soft disabled:text-muted"><Sparkles size={18} /><span className="text-[14px] font-medium">{aiEnabled ? "Ask ScheduRx" : "Assistant is off"}</span></button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
