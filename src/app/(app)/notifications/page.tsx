"use client";

import { AlertTriangle, Bell, CalendarClock, Check, CheckCheck, Clock, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useClinic } from "@/stores";
import { useNotifications } from "@/hooks/use-notifications";
import { Empty } from "@/components/ui/empty";
import { relTime } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import type { NotifKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const META: Record<NotifKind, { icon: React.ElementType; cls: string }> = {
  critical: { icon: AlertTriangle, cls: "bg-danger-soft text-danger" },
  reminder: { icon: Clock, cls: "bg-surface-soft text-muted" },
  booking: { icon: CalendarClock, cls: "bg-primary-soft text-primary" },
  review: { icon: Star, cls: "bg-surface-soft text-muted" },
  waitlist: { icon: Users, cls: "bg-warning-soft text-warning" },
  system: { icon: Bell, cls: "bg-surface-soft text-muted" },
};

function groupFor(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = startToday - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (diff <= 0) return "Today";
  if (diff <= 86400000) return "Yesterday";
  return "Earlier";
}

export default function NotificationsPage() {
  const { markNotifsRead, markNotifRead, removeNotif } = useClinic();
  const { data: notifs = [] } = useNotifications();
  const unread = notifs.filter((notif) => !notif.read).length;
  const groups = ["Today", "Yesterday", "Earlier"].map((name) => ({ name, items: notifs.filter((notif) => groupFor(notif.at) === name) })).filter((group) => group.items.length);

  const onMarkRead = async (id: string) => {
    try {
      await markNotifRead(id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't mark that as read.");
    }
  };
  const onRemove = async (id: string) => {
    try {
      await removeNotif(id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove that notification.");
    }
  };

  return (
    <div className="stagger mx-auto max-w-2xl space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div><p className="text-[12px] text-muted">Clinic signal</p><h1 className="mt-1 font-display text-[clamp(2.7rem,10.5vw,4.2rem)] font-light leading-[0.94] tracking-[-0.055em]">Notifications</h1></div>
        {unread > 0 && <button onClick={() => void markNotifsRead()} className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Mark all notifications read"><CheckCheck size={18} /></button>}
      </header>

      {notifs.length === 0 && <Empty icon={Bell} title="All quiet" body="Critical cases, bookings and reviews will land here." />}

      <div className="space-y-7">
        {groups.map((group) => (
          <section key={group.name}>
            <p className="mb-3 px-1 text-[12px] text-muted">{group.name}</p>
            <div className="overflow-hidden rounded-panel bg-surface px-2 shadow-card">
              {group.items.map((notif, index) => {
                const Meta = META[notif.kind];
                return (
                  <article key={notif.id} className={cn("flex min-h-[82px] items-start gap-3 px-2 py-4", index !== group.items.length - 1 && "border-b border-border/60", !notif.read && "text-ink")}>
                    <span className={cn("mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full", Meta.cls)}><Meta.icon size={16} /></span>
                    <div className="min-w-0 flex-1"><div className="flex items-start gap-2"><p className={cn("text-[13.5px] leading-snug", !notif.read && "font-medium")}>{notif.text}</p>{!notif.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}</div><p className="mt-2 text-[10.5px] text-faint">{relTime(notif.at)}</p></div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!notif.read && (
                        <button onClick={() => void onMarkRead(notif.id)} aria-label="Mark as read" className="pressable flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-primary-soft hover:text-primary"><Check size={15} /></button>
                      )}
                      <button onClick={() => void onRemove(notif.id)} aria-label="Remove notification" className="pressable flex h-9 w-9 items-center justify-center rounded-full text-faint hover:bg-danger-soft hover:text-danger"><Trash2 size={14} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-faint">Critical cases can also reach your phone when alerts are enabled in Profile.</p>
    </div>
  );
}
