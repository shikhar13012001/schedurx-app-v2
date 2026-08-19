"use client";

import { createElement, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Bell, CalendarClock, Clock, Star, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { fromApiNotification, type ApiNotification } from "@/lib/adapters";
import { useSession } from "@/stores";
import type { Notif, NotifKind } from "@/lib/types";

export function useNotifications() {
  const clinicId = useSession((s) => s.session?.clinicId);
  return useQuery({
    queryKey: ["notifications", clinicId],
    enabled: !!clinicId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { notifications } = await api.get<{ notifications: ApiNotification[] }>("/api/v1/notifications");
      return notifications.map(fromApiNotification);
    },
  });
}

const TOAST_META: Record<NotifKind, { icon: React.ElementType; label: string }> = {
  critical: { icon: AlertTriangle, label: "Critical alert" },
  reminder: { icon: Clock, label: "Reminder" },
  booking: { icon: CalendarClock, label: "New booking" },
  review: { icon: Star, label: "New review" },
  waitlist: { icon: Users, label: "Waitlist update" },
  system: { icon: Bell, label: "Notification" },
};

// Pops a toast for any notification that wasn't present on the previous poll.
// The first render just seeds the "seen" set — otherwise every already-existing
// notification would toast the moment the app loads.
export function useNotificationToasts(notifs: Notif[] | undefined) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!notifs) return;
    if (!seen.current) {
      seen.current = new Set(notifs.map((n) => n.id));
      return;
    }
    const fresh = notifs.filter((n) => !n.read && !seen.current!.has(n.id));
    for (const n of fresh) {
      const meta = TOAST_META[n.kind] ?? TOAST_META.system;
      toast(meta.label, { description: n.text, icon: createElement(meta.icon, { size: 16 }) });
    }
    seen.current = new Set(notifs.map((n) => n.id));
  }, [notifs]);
}
