"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarOff } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useClinic } from "@/stores";
import { ApiError } from "@/lib/api-client";
import { cn, dateAt, toDateKey } from "@/lib/utils";

const PRESETS = [60, 120, 180, 240];

function nowHm() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function BlockTimeSheet({ open, onOpenChange, doctorId, prefillDay }: { open: boolean; onOpenChange: (o: boolean) => void; doctorId: string; prefillDay?: string }) {
  const blockTime = useClinic((s) => s.blockTime);
  const [day, setDay] = useState(() => prefillDay ?? toDateKey(new Date()));
  const [from, setFrom] = useState(nowHm);
  const [minutes, setMinutes] = useState(180);
  const [reason, setReason] = useState("");

  // Re-seed from the calendar's currently selected day (and reset the rest)
  // each time the sheet opens — otherwise a stale day/time lingers from the
  // last time it was used.
  useEffect(() => {
    if (!open) return;
    setDay(prefillDay ?? toDateKey(new Date()));
    setFrom(nowHm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const apply = async () => {
    const [h, m] = from.split(":").map(Number);
    try {
      await blockTime(doctorId, dateAt(day, h, m), minutes, reason || "Not available");
      toast.success(`Blocked ${minutes / 60}h from ${from}`, { description: "New bookings can't land in this window." });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't block that window — it may already be taken.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Block your time">
      <p className="-mt-1 mb-6 max-w-[360px] text-[13px] leading-relaxed text-muted">You own your calendar. Anyone already booked inside this window gets an automatic reschedule call.</p>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" min={toDateKey(new Date())} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
          <Field label="From"><Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">For how long</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setMinutes(p)}
                className={cn("pressable rounded-[22px] py-3 text-[14px] transition-colors",
                  minutes === p ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}>
                {p / 60}h
              </button>
            ))}
          </div>
        </div>
        <Field label="Reason (optional)"><Input placeholder="Hospital rounds, personal…" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Button size="lg" className="w-full" onClick={() => void apply()}><CalendarOff size={16} /> Block this window</Button>
      </div>
    </Sheet>
  );
}
