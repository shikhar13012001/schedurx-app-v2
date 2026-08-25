"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Phone, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { useClinic, type CommWorkflow, type CommChannel, type CommTrigger } from "@/stores";
import { useDoctors } from "@/hooks/use-team";
import { usePhoneRoutes, useCreatePhoneRoute, useUpdatePhoneRoute, useDeletePhoneRoute } from "@/hooks/use-phone-routes";
import { useMessageFailures, useRetryQueue, type MessageFailure, type RetryQueueItem } from "@/hooks/use-messaging";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const CHANNELS: { v: CommChannel; label: string }[] = [
  { v: "whatsapp", label: "WhatsApp" },
  { v: "sms", label: "SMS" },
];

const TRIGGERS: { v: CommTrigger; label: string; delayed: boolean }[] = [
  { v: "booking_confirmed", label: "Booking confirmed", delayed: false },
  { v: "reschedule", label: "Rescheduled", delayed: false },
  { v: "cancellation", label: "Cancelled", delayed: false },
  { v: "reminder", label: "Reminder before visit", delayed: true },
  { v: "pre_appointment", label: "Before appointment", delayed: true },
  { v: "post_appointment", label: "After appointment", delayed: true },
  { v: "review_request", label: "Review request", delayed: true },
  { v: "missed_call_followup", label: "Missed call follow-up", delayed: true },
];

function emptyWorkflow(): CommWorkflow {
  return { id: `wf_${Date.now()}`, trigger: "reminder", channel: "whatsapp", offsetMinutes: -1440, template: "", enabled: true };
}

function WorkflowSheet({ open, onOpenChange, workflow, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; workflow: CommWorkflow | null; onSave: (w: CommWorkflow) => void;
}) {
  const [draft, setDraft] = useState<CommWorkflow>(workflow ?? emptyWorkflow());
  useEffect(() => { if (open) setDraft(workflow ?? emptyWorkflow()); }, [open, workflow]);
  const triggerMeta = TRIGGERS.find((t) => t.v === draft.trigger);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={workflow ? "Edit workflow" : "New workflow"}>
      <div className="space-y-5">
        <Field label="When">
          <select value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value as CommTrigger })} className="h-12 w-full rounded-field bg-surface-soft px-3.5 text-[14px] text-ink outline-none focus:ring-4 focus:ring-primary/10">
            {TRIGGERS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </Field>
        {triggerMeta?.delayed && (
          <Field label="Timing" hint="Minutes relative to the appointment start — negative is before, positive is after.">
            <Input type="number" value={draft.offsetMinutes} onChange={(e) => setDraft({ ...draft, offsetMinutes: Number(e.target.value) || 0 })} />
          </Field>
        )}
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Channel</p>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map((c) => (
              <button type="button" key={c.v} onClick={() => setDraft({ ...draft, channel: c.v })}
                className={cn("pressable h-11 rounded-pill text-[13px] transition-colors", draft.channel === c.v ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Message" hint="Use {{patientName}}, {{doctorName}}, {{clinicName}}, {{apptTime}}, {{bookingUrl}}, {{reviewUrl}}, {{textCommsUrl}}">
          <Textarea rows={3} placeholder="Hi {{patientName}}, reminder: your appointment with {{doctorName}} is {{apptTime}}." value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value })} />
        </Field>
        <label className="flex items-center justify-between rounded-panel bg-surface-soft px-4 py-4">
          <span className="text-[14px] font-medium">Enabled</span>
          <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
        </label>
        <Button size="lg" className="w-full" disabled={!draft.template.trim()} onClick={() => { onSave(draft); onOpenChange(false); }}>
          Save workflow
        </Button>
      </div>
    </Sheet>
  );
}

// Relative "X min/hr/days ago" — no date library dependency needed for the
// coarse granularity this section actually needs.
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PURPOSE_LABELS: Record<string, string> = {
  booking_confirmed: "Booking confirmation",
  reschedule: "Reschedule notice",
  cancellation: "Cancellation notice",
  reminder: "Reminder",
  pre_appointment: "Pre-visit message",
  post_appointment: "Post-visit message",
  review_request: "Review request",
  missed_call_followup: "Missed-call follow-up",
  token_payment: "Payment link",
  team_invite: "Team invite",
};

function purposeLabel(purpose: string | null): string {
  return (purpose && PURPOSE_LABELS[purpose]) || purpose || "Message";
}

function DeliveryRow({ channel, toPhone, purpose, when, detail }: { channel: string; toPhone: string | null; purpose: string | null; when: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] bg-surface-soft px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertTriangle size={14} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13.5px] font-medium">{purposeLabel(purpose)} · {channel}</p>
          <span className="shrink-0 text-[11px] text-faint">{timeAgo(when)}</span>
        </div>
        <p className="truncate text-[12px] text-muted">{toPhone ?? "unknown number"}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-danger">{detail}</p>
      </div>
    </div>
  );
}

// Staff-facing view of tonight's delivery-tracking work — until this
// existed, "did that confirmation actually send" was only answerable by
// asking an engineer to check the database directly. Two categories, both
// meaning "this needs a human, automatic retry is done or never applied":
// real Twilio delivery failures (MessageLog), and retry-queue items that
// exhausted every attempt (FailedMessage).
function DeliveryStatusSection() {
  const { data: failures, isLoading: failuresLoading } = useMessageFailures();
  const { data: exhausted, isLoading: exhaustedLoading } = useRetryQueue("exhausted");

  const loading = failuresLoading || exhaustedLoading;
  const failureRows = failures ?? [];
  const exhaustedRows = exhausted ?? [];
  const hasIssues = failureRows.length > 0 || exhaustedRows.length > 0;

  return (
    <section className="rounded-panel bg-surface p-5 shadow-card">
      <div className="mb-1 flex items-center gap-2">
        {hasIssues ? <AlertTriangle size={16} className="text-danger" /> : <CheckCircle2 size={16} className="text-primary" />}
        <h2 className="text-[16px] font-medium">Delivery status</h2>
      </div>
      <p className="mb-4 text-[13px] text-muted">Confirmations, reminders, and other messages that didn&apos;t actually reach a patient.</p>

      {loading && <p className="py-4 text-center text-[13px] text-faint">Checking…</p>}

      {!loading && !hasIssues && (
        <p className="py-4 text-center text-[13px] text-faint">No delivery issues in the last 24 hours.</p>
      )}

      {!loading && hasIssues && (
        <div className="space-y-4">
          {exhaustedRows.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted"><RefreshCw size={12} /> Gave up after {exhaustedRows[0]?.maxAttempts ?? 3} attempts</p>
              <div className="space-y-2">
                {exhaustedRows.slice(0, 10).map((row: RetryQueueItem) => (
                  <DeliveryRow key={row.id} channel={row.channel} toPhone={row.toPhone} purpose={row.purpose} when={row.updatedAt} detail={row.lastError ?? "Unknown error"} />
                ))}
              </div>
            </div>
          )}
          {failureRows.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-medium text-muted">Twilio reported undelivered</p>
              <div className="space-y-2">
                {failureRows.slice(0, 10).map((row: MessageFailure) => (
                  <DeliveryRow key={row.id} channel={row.channel} toPhone={row.toPhone} purpose={row.purpose} when={row.updatedAt} detail={row.errorMessage ?? row.errorCode ?? row.status} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PhoneRoutesSection() {
  const { data: routes } = usePhoneRoutes();
  const { data: doctors } = useDoctors();
  const createRoute = useCreatePhoneRoute();
  const updateRoute = useUpdatePhoneRoute();
  const deleteRoute = useDeletePhoneRoute();
  const [newNumber, setNewNumber] = useState("");

  const addRoute = async () => {
    if (!newNumber.trim()) return;
    try {
      await createRoute.mutateAsync({ originalNumber: newNumber.trim() });
      setNewNumber("");
      toast.success("Number registered");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't add that number.");
    }
  };

  return (
    <section className="rounded-panel bg-surface p-5 shadow-card">
      <div className="mb-1 flex items-center gap-2"><Phone size={16} className="text-primary" /><h2 className="text-[16px] font-medium">Phone routing</h2></div>
      <p className="mb-4 text-[13px] text-muted">Real clinic/doctor numbers that forward missed calls to the shared ScheduRx number.</p>
      <div className="space-y-2">
        {(routes ?? []).map((route) => (
          <div key={route.id} className="flex items-center gap-3 rounded-[18px] bg-surface-soft px-4 py-3">
            <span className="flex-1 text-[13.5px] tabular-nums">{route.originalNumber}</span>
            <span className="text-[12px] text-muted">{doctors?.find((d) => d.id === route.doctorId)?.name ?? "Clinic-wide"}</span>
            <Switch checked={route.isActive} onCheckedChange={(v) => updateRoute.mutate({ id: route.id, patch: { isActive: v } })} />
            <button onClick={() => deleteRoute.mutate(route.id)} className="pressable flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove number"><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Input placeholder="+91XXXXXXXXXX" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} className="h-11" />
          <Button size="sm" onClick={addRoute} disabled={createRoute.isPending}><Plus size={14} /> Add</Button>
        </div>
      </div>
    </section>
  );
}

export default function AutomationsPage() {
  const { settings, setSetting } = useClinic();
  const [draft, setDraft] = useState(settings.communication);
  const [editing, setEditing] = useState<CommWorkflow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(settings.communication); }, [settings.communication]);

  const toggleChannel = (c: CommChannel) => {
    setDraft((d) => ({ ...d, channelsEnabled: d.channelsEnabled.includes(c) ? d.channelsEnabled.filter((x) => x !== c) : [...d.channelsEnabled, c] }));
  };

  const saveWorkflow = (w: CommWorkflow) => {
    setDraft((d) => ({ ...d, workflows: d.workflows.some((x) => x.id === w.id) ? d.workflows.map((x) => (x.id === w.id ? w : x)) : [...d.workflows, w] }));
  };
  const removeWorkflow = (id: string) => setDraft((d) => ({ ...d, workflows: d.workflows.filter((w) => w.id !== id) }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.communication);

  const save = async () => {
    setSaving(true);
    try {
      await setSetting("communication", draft);
      toast.success("Automations saved");
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 403 ? "Only the clinic owner can change this." : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stagger mx-auto max-w-2xl space-y-8 pb-24">
      <header>
        <p className="text-[12px] text-muted">Settings</p>
        <h1 className="mt-1 text-balance font-display text-[clamp(2.2rem,8vw,3rem)] font-light leading-[0.98] tracking-[-0.05em]">Automations</h1>
        <p className="mt-2 text-[13px] text-muted">What patients hear on a missed call, and what they&apos;re texted automatically.</p>
      </header>

      <section className="rounded-panel bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-[16px] font-medium">Channels</h2>
        <p className="mb-4 text-[13px] text-muted">Which channels workflows below are allowed to use.</p>
        <div className="grid grid-cols-2 gap-2">
          {CHANNELS.map((c) => (
            <button type="button" key={c.v} onClick={() => toggleChannel(c.v)}
              className={cn("pressable h-12 rounded-pill text-[13px] transition-colors", draft.channelsEnabled.includes(c.v) ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-panel bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-[16px] font-medium">Voice greeting</h2>
        <p className="mb-4 text-[13px] text-muted">Spoken when a missed call forwards to ScheduRx. Use {"{{clinicName}}"}, {"{{clinicPhone}}"}.</p>
        <Textarea rows={2} placeholder="Thanks for calling {{clinicName}}. We'll text you shortly to help you book." value={draft.voiceGreetingTemplate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, voiceGreetingTemplate: e.target.value }))} />
      </section>

      <section className="rounded-panel bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="text-[16px] font-medium">Workflows</h2><p className="text-[13px] text-muted">Confirmations, reminders, and notices sent automatically.</p></div>
          <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true); }}><Plus size={14} /> Add</Button>
        </div>
        <div className="space-y-2">
          {draft.workflows.length === 0 && <p className="py-4 text-center text-[13px] text-faint">No workflows configured yet.</p>}
          {draft.workflows.map((w) => (
            <div key={w.id} className={cn("flex items-center gap-3 rounded-[18px] bg-surface-soft px-4 py-3", !w.enabled && "opacity-50")}>
              <button onClick={() => { setEditing(w); setSheetOpen(true); }} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13.5px] font-medium">{TRIGGERS.find((t) => t.v === w.trigger)?.label ?? w.trigger}</p>
                <p className="truncate text-[12px] text-muted">{w.channel} · {w.template || "No message set"}</p>
              </button>
              <button onClick={() => removeWorkflow(w.id)} className="pressable flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove workflow"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      <DeliveryStatusSection />

      <PhoneRoutesSection />

      <Button size="lg" className="w-full" disabled={!dirty || saving} onClick={save}>
        {dirty ? "Save changes" : "Saved"}
      </Button>

      <WorkflowSheet open={sheetOpen} onOpenChange={setSheetOpen} workflow={editing} onSave={saveWorkflow} />
    </div>
  );
}
