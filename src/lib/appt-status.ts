import type { Badge } from "@/components/ui/badge";
import type { ApptStatus } from "@/lib/types";

export const APPT_STATUS_META: Record<ApptStatus, { label: string; tone: React.ComponentProps<typeof Badge>["tone"] }> = {
  confirmed: { label: "Booked", tone: "primary" },
  tentative: { label: "Booked", tone: "primary" },
  waitlist: { label: "Waitlisted", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  no_show: { label: "No-show", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "warning" },
  blocked: { label: "Blocked", tone: "neutral" },
};
