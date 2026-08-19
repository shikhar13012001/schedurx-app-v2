"use client";

import * as React from "react";
import { CalendarClock, Check, Circle, Clock, ListTodo, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useClinic, useSession } from "@/stores";
import { useTasks } from "@/hooks/use-tasks";
import { useDoctors } from "@/hooks/use-team";
import { Empty } from "@/components/ui/empty";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { dueLabel, dateAt, toDateKey } from "@/lib/utils";
import { cn } from "@/lib/utils";

const CHIPS = [
  { key: "1h", label: "In 1 hour" },
  { key: "tonight", label: "Tonight 8pm" },
  { key: "tmrw", label: "Tomorrow 9am" },
] as const;

const BLOCK_MINUTES = [30, 60, 90, 120];

function chipToIso(key: string): string {
  const date = new Date();
  if (key === "1h") date.setHours(date.getHours() + 1);
  if (key === "tonight") {
    date.setHours(20, 0, 0, 0);
    if (date.getTime() < Date.now()) date.setDate(date.getDate() + 1);
  }
  if (key === "tmrw") {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
  }
  return date.toISOString();
}

export default function TasksPage() {
  const session = useSession((s) => s.session);
  const { data: doctors } = useDoctors();
  const { addTask, toggleTask, removeTask, blockTime } = useClinic();
  const { data: tasks = [] } = useTasks();
  const [text, setText] = React.useState("");
  const [chip, setChip] = React.useState<string | null>(null);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customDate, setCustomDate] = React.useState(() => toDateKey(new Date()));
  const [customTime, setCustomTime] = React.useState("");
  const [blocking, setBlocking] = React.useState(false);
  const [blockMinutes, setBlockMinutes] = React.useState(60);

  const due = customOpen && customTime
    ? dateAt(customDate, ...(customTime.split(":").map(Number) as [number, number]))
    : chip
      ? chipToIso(chip)
      : undefined;

  async function submit() {
    const title = text.trim();
    if (!title) return;
    const dueAt = due;
    setText(""); setChip(null); setCustomOpen(false); setCustomTime(""); setBlocking(false);

    try {
      await addTask(title, dueAt);
      if (dueAt && blocking) {
        const doctorId = session?.doctorId ?? doctors?.[0]?.id;
        if (doctorId) await blockTime(doctorId, dueAt, blockMinutes, title);
      }
      toast.success(dueAt ? (blocking ? "Task added and time blocked on your calendar." : "Task added — I'll nudge you.") : "Task added.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't add that task.");
    }
  }

  const open = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);

  return (
    <div className="stagger mx-auto max-w-2xl space-y-8">
      <header>
        <p className="text-[12px] text-muted">Personal flow</p>
        <h1 className="mt-1 font-display text-[clamp(3rem,12vw,4.4rem)] font-light leading-[0.94] tracking-[-0.055em]">Tasks</h1>
      </header>

      <section className="rounded-panel bg-surface p-3 shadow-card">
        <div className="flex min-h-[60px] items-center gap-2 rounded-[25px] bg-surface-soft px-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-muted"><Plus size={18} /></span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void submit()}
            placeholder="What needs to be done?"
            className="h-14 min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-faint"
          />
          <button onClick={() => void submit()} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-charcoal text-white" aria-label="Add task"><Check size={17} /></button>
        </div>
        <div className="flex flex-wrap gap-2 px-1 pb-1 pt-3">
          {CHIPS.map((item) => (
            <button key={item.key} onClick={() => { setCustomOpen(false); setChip(chip === item.key ? null : item.key); }} className={cn("pressable rounded-pill px-3 py-2 text-[11px]", chip === item.key ? "bg-primary text-charcoal" : "bg-surface-soft text-muted")}>
              <Clock size={11} className="mr-1 inline" />{item.label}
            </button>
          ))}
          <button onClick={() => { setChip(null); setCustomOpen((v) => !v); }} className={cn("pressable rounded-pill px-3 py-2 text-[11px]", customOpen ? "bg-primary text-charcoal" : "bg-surface-soft text-muted")}>
            <CalendarClock size={11} className="mr-1 inline" />Custom time
          </button>
        </div>

        {customOpen && (
          <div className="grid grid-cols-2 gap-3 px-1 pb-2 pt-3">
            <Field label="Date"><Input type="date" min={toDateKey(new Date())} value={customDate} onChange={(e) => setCustomDate(e.target.value)} /></Field>
            <Field label="Time"><Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} /></Field>
          </div>
        )}

        {due && (
          <div className="mx-1 mt-1 rounded-[20px] bg-surface-soft px-4 py-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="text-[13px] font-medium">Also block my calendar</span>
                <span className="block text-[11px] text-muted">Reserves this time so no appointment lands in it</span>
              </span>
              <Switch checked={blocking} onCheckedChange={setBlocking} />
            </label>
            {blocking && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {BLOCK_MINUTES.map((m) => (
                  <button key={m} onClick={() => setBlockMinutes(m)} className={cn("pressable rounded-[16px] py-2 text-[12px] transition-colors", blockMinutes === m ? "bg-charcoal text-white" : "bg-surface text-muted")}>
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {open.length === 0 && done.length === 0 && <Empty icon={ListTodo} title="A rare clean slate" body="Add a task here or ask ScheduRx to create one for you." />}

      {open.length > 0 && (
        <section>
          <p className="mb-3 px-1 text-[12px] text-muted">Next</p>
          <div className="overflow-hidden rounded-panel bg-surface px-2 shadow-card">
            {open.map((task, index) => (
              <div key={task.id} className={cn("flex min-h-[76px] items-center gap-3 px-2 py-3", index !== open.length - 1 && "border-b border-border/60")}>
                <button onClick={() => void toggleTask(task.id, true)} aria-label="Complete task" className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft text-muted"><Circle size={18} /></button>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[14px] leading-snug">{task.text}{task.viaAI && <Sparkles size={12} className="shrink-0 text-primary" aria-label="Added by AI" />}</p>
                  {task.due && <p className="mt-1 text-[11.5px] text-muted">Due {dueLabel(task.due)}</p>}
                </div>
                <button onClick={() => void removeTask(task.id)} aria-label="Delete task" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-faint hover:bg-danger-soft hover:text-danger"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <p className="mb-3 px-1 text-[12px] text-faint">Completed</p>
          <div className="overflow-hidden rounded-panel bg-surface-soft px-2">
            {done.map((task, index) => (
              <div key={task.id} className={cn("flex min-h-[68px] items-center gap-3 px-2 py-3 opacity-[0.55]", index !== done.length - 1 && "border-b border-border/50")}>
                <button onClick={() => void toggleTask(task.id, false)} aria-label="Reopen task" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-success"><Check size={16} /></button>
                <p className="min-w-0 flex-1 text-[13px] line-through">{task.text}</p>
                <button onClick={() => void removeTask(task.id)} aria-label="Delete task" className="flex h-10 w-10 items-center justify-center text-faint"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
