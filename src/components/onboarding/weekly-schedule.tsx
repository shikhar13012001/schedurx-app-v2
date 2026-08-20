"use client";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS: { v: string; label: string }[] = [
  { v: "Mon", label: "M" },
  { v: "Tue", label: "T" },
  { v: "Wed", label: "W" },
  { v: "Thu", label: "T" },
  { v: "Fri", label: "F" },
  { v: "Sat", label: "S" },
  { v: "Sun", label: "S" },
];

export type Break = { label: string; start: string; end: string };

// Doctor.workingHoursStart/End (and Staff's mirrored columns) are a single
// shared start/end, not per-day — so unlike a from-scratch design, this
// intentionally has one time range for every selected day rather than a
// per-day-different picker, matching what the schema actually stores.
export function WeeklySchedule({
  workingDays,
  onWorkingDaysChange,
  start,
  end,
  onStartChange,
  onEndChange,
  breaks,
  onBreaksChange,
}: {
  workingDays: string[];
  onWorkingDaysChange: (days: string[]) => void;
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  breaks: Break[];
  onBreaksChange: (b: Break[]) => void;
}) {
  const toggleDay = (day: string) => {
    onWorkingDaysChange(workingDays.includes(day) ? workingDays.filter((d) => d !== day) : [...workingDays, day]);
  };

  const addBreak = (label: string, defaultStart: string, defaultEnd: string) => {
    onBreaksChange([...breaks, { label, start: defaultStart, end: defaultEnd }]);
  };
  const removeBreak = (idx: number) => onBreaksChange(breaks.filter((_, i) => i !== idx));
  const updateBreak = (idx: number, patch: Partial<Break>) =>
    onBreaksChange(breaks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2.5 text-[13px] font-normal text-muted">Which days</p>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <button
              key={d.v}
              type="button"
              onClick={() => toggleDay(d.v)}
              aria-pressed={workingDays.includes(d.v)}
              aria-label={d.v}
              className={cn(
                "pressable flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-medium transition-colors",
                workingDays.includes(d.v) ? "bg-charcoal text-white" : "bg-surface-2 text-muted",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {workingDays.length > 0 && (
        <div>
          <p className="mb-2.5 text-[13px] font-normal text-muted">Hours on those days</p>
          <div className="flex items-center gap-3 rounded-panel bg-surface-2/70 p-4">
            <input
              type="time"
              value={start}
              onChange={(e) => onStartChange(e.target.value)}
              className="h-11 flex-1 rounded-control border border-border/70 bg-surface px-3 text-[14px] text-ink outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
            <span className="text-faint">→</span>
            <input
              type="time"
              value={end}
              onChange={(e) => onEndChange(e.target.value)}
              className="h-11 flex-1 rounded-control border border-border/70 bg-surface px-3 text-[14px] text-ink outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>
      )}

      <div>
        <p className="mb-2.5 text-[13px] font-normal text-muted">Breaks</p>
        {breaks.length === 0 && <p className="text-[13px] text-faint">No breaks added.</p>}
        <div className="space-y-2">
          {breaks.map((b, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-field bg-surface-2/70 px-3.5 py-2.5">
              <span className="w-16 shrink-0 text-[13px] font-medium text-ink">{b.label}</span>
              <input
                type="time"
                value={b.start}
                onChange={(e) => updateBreak(i, { start: e.target.value })}
                className="h-9 flex-1 rounded-control border border-border/70 bg-surface px-2 text-[13px] text-ink outline-none"
              />
              <span className="text-faint text-xs">→</span>
              <input
                type="time"
                value={b.end}
                onChange={(e) => updateBreak(i, { end: e.target.value })}
                className="h-9 flex-1 rounded-control border border-border/70 bg-surface px-2 text-[13px] text-ink outline-none"
              />
              <button type="button" onClick={() => removeBreak(i)} aria-label={`Remove ${b.label}`} className="p-1 text-faint hover:text-danger">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {!breaks.some((b) => b.label === "Lunch") && (
            <button type="button" onClick={() => addBreak("Lunch", "13:00", "14:00")} className="pressable inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface-2 px-3.5 text-[13px] text-muted hover:bg-surface-3">
              <Plus size={13} /> Lunch break
            </button>
          )}
          <button type="button" onClick={() => addBreak("Break", "16:00", "16:15")} className="pressable inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface-2 px-3.5 text-[13px] text-muted hover:bg-surface-3">
            <Plus size={13} /> Another break
          </button>
        </div>
      </div>
    </div>
  );
}
