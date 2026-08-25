// Translates between schedurx-backend's raw Supabase row shapes (camelCase
// Postgres columns, documented in schedurx-backend/docs/live-schema-baseline.md)
// and this app's existing src/lib/types.ts shapes. Keeping this translation at
// the edges means every component built against types.ts keeps working
// unchanged once the store/hooks call the real API instead of mock data.
//
// Some frontend fields have no backend column yet (e.g. Appointment.pay/mode,
// Thread.triage/aiSummary, Patient.tags/review) — those are real product gaps,
// not adapter bugs, and are called out inline. They get sensible defaults here
// rather than breaking the UI.

import type {
  Appointment, ApptStatus, ApptSource, CallLog, ChatMsg, DayStat, Doctor, Invoice,
  Notif, Patient, QueueItem, QueueState, Staff, Task, Thread, Triage, Visit, VisitMode, WaLog,
} from "@/lib/types";
import type { Settings } from "@/stores";

// ─── Doctor ───────────────────────────────────────────────────────────────────

export interface ApiDoctor {
  id: string;
  fullName: string;
  specialty?: string | null;
  qualification?: string | null;
  languages?: string[] | null;
  feeInr?: number | null;
  bio?: string | null;
  workingHoursStart?: string | null;
  workingHoursEnd?: string | null;
  slotDurationOverrideMins?: number | null;
  isActive?: boolean;
}

export function fromApiDoctor(d: ApiDoctor): Doctor {
  return {
    id: d.id,
    name: d.fullName,
    specialty: d.specialty ?? "General Physician",
    fee: d.feeInr ?? 0,
    slotMinutes: d.slotDurationOverrideMins ?? 30,
    // regNo has no backend column yet (Telemedicine Practice Guidelines 2020
    // requires it on prescriptions) — surfaces empty until that's added.
    regNo: "",
    availableNow: d.isActive ?? true,
    todayHours: d.workingHoursStart && d.workingHoursEnd ? `${d.workingHoursStart}–${d.workingHoursEnd}` : "—",
    bio: d.bio ?? undefined,
  };
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface ApiStaff {
  id: string;
  fullName?: string | null;
  role: "doctor" | "receptionist" | "owner";
  email?: string | null;
  doctorId?: string | null;
}

export function fromApiStaff(s: ApiStaff): Staff {
  return {
    id: s.id,
    name: s.fullName ?? s.email ?? "Staff member",
    // Frontend Role has no "owner" — owners see the doctor shell.
    role: s.role === "receptionist" ? "receptionist" : "doctor",
    email: s.email ?? "",
    doctorId: s.doctorId ?? undefined,
    // No presence/online tracking on the backend yet.
    onlineNow: false,
  };
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export interface ApiPatient {
  id: string;
  fullName?: string | null;
  contactNumber: string;
  age?: number | null;
  gender?: string | null;
  visitsCount?: number;
  lastVisitDate?: string | null;
}

export function fromApiPatient(p: ApiPatient, visits: Visit[] = []): Patient {
  return {
    id: p.id,
    name: p.fullName || "Unknown",
    phone: p.contactNumber,
    age: p.age ?? 0,
    gender: (p.gender as Patient["gender"]) ?? "O",
    // tags/review/email have no backend column yet.
    tags: [],
    review: "none",
    visits,
    // The list endpoint sends a real visitsCount/lastVisitDate but no full
    // `visits` array (too expensive per-row); the detail page fetches full
    // `visits` but doesn't send these — either way this resolves correctly.
    visitsCount: p.visitsCount ?? visits.length,
    lastVisitDate: p.lastVisitDate ?? visits[0]?.date,
  };
}

export function toApiPatientInput(patient: { name: string; phone: string; age?: number; gender?: string }) {
  return { fullName: patient.name, phone: patient.phone, age: patient.age, gender: patient.gender };
}

// ─── Appointment ──────────────────────────────────────────────────────────────

const STATUS_FROM_API: Record<string, ApptStatus> = {
  booked: "confirmed",
  confirmed: "confirmed",
  // Backend no longer writes this literal on reschedule (it keeps the prior
  // booked/blocked status instead — see appointment-service.js), but mapped
  // here too as defense-in-depth against any older row or other write path.
  rescheduled: "confirmed",
  tentative: "tentative",
  waitlist: "waitlist",
  completed: "completed",
  no_show: "no_show",
  cancelled: "cancelled",
  blocked: "blocked",
};

export interface ApiAppointment {
  id: string;
  patientId?: string | null;
  doctorId: string;
  timeslot: string;
  durationMinutes?: number | null;
  status: string;
  source?: string | null;
  symptoms?: string | null;
  notes?: string | null;
  mode?: string | null;
  tokenRequested?: boolean | null;
}

export function fromApiAppointment(a: ApiAppointment): Appointment {
  return {
    id: a.id,
    patientId: a.patientId ?? undefined,
    doctorId: a.doctorId,
    startsAt: a.timeslot,
    durationMin: a.durationMinutes ?? 30,
    status: STATUS_FROM_API[a.status] ?? "tentative",
    source: (a.source as ApptSource) ?? "reception",
    // meetLink/critical still have no backend column — mode/pay do now (see
    // 20260823_appointment_mode_and_token.sql); this used to hard-default
    // both, which meant a Video+token booking was silently read back and
    // displayed as an in-clinic, unpaid one.
    pay: a.tokenRequested ? "token" : "unpaid",
    mode: (a.mode as VisitMode) ?? "clinic",
    symptoms: a.symptoms ?? undefined,
    blockReason: a.status === "blocked" ? (a.notes ?? undefined) : undefined,
  };
}

// ─── QueueItem ────────────────────────────────────────────────────────────────

export interface ApiQueueItem {
  id: string;
  appointmentId?: string | null;
  patientId?: string | null;
  doctorId: string;
  status: QueueState;
  walkIn?: boolean;
  checkedInAt?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
}

// Extra fields (displayName/phoneNumber) ride along for walk-ins that have no
// Patient row yet — components that only know src/lib/types.ts's QueueItem
// shape ignore them; the queue view uses them for the guest's name.
export type AdaptedQueueItem = QueueItem & { displayName?: string; phoneNumber?: string };

export function fromApiQueueItem(q: ApiQueueItem): AdaptedQueueItem {
  return {
    id: q.id,
    apptId: q.appointmentId ?? undefined,
    patientId: q.patientId ?? "",
    doctorId: q.doctorId,
    state: q.status,
    walkIn: q.walkIn ?? false,
    arrivedAt: q.checkedInAt ?? undefined,
    displayName: q.displayName ?? undefined,
    phoneNumber: q.phoneNumber ?? undefined,
  };
}

// ─── Possible no-show ─────────────────────────────────────────────────────────
// GET /api/v1/queue's second list, alongside the queue itself — booked
// appointments past the clinic's grace period with nobody checked in.
// Computed fresh on every fetch by the backend, never persisted, so there's
// no separate "state" to adapt beyond the raw appointment fields.

export interface ApiPossibleNoShow {
  id: string;
  doctorId: string;
  patientId: string;
  timeslot: string;
  symptoms?: string | null;
}

export interface PossibleNoShow {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  startsAt: string;
  symptoms?: string;
}

export function fromApiPossibleNoShow(a: ApiPossibleNoShow): PossibleNoShow {
  return {
    appointmentId: a.id,
    doctorId: a.doctorId,
    patientId: a.patientId,
    startsAt: a.timeslot,
    symptoms: a.symptoms ?? undefined,
  };
}

// ─── Visit ────────────────────────────────────────────────────────────────────

export interface ApiRxAttachment { path: string; type: "photo" | "digital" | "audio"; uploadedAt: string }

export interface ApiVisit {
  id: string;
  visitDate: string;
  createdAt?: string | null;
  doctorId?: string | null;
  mode?: string | null;
  symptoms?: string | null;
  notes?: string | null;
  followUpDate?: string | null;
  rxAttachments?: ApiRxAttachment[] | null;
}

export function fromApiVisit(v: ApiVisit): Visit {
  const attachments = v.rxAttachments ?? [];
  return {
    id: v.id,
    date: v.visitDate,
    recordedAt: v.createdAt ?? undefined,
    doctorId: v.doctorId ?? "",
    mode: (v.mode as VisitMode) ?? "clinic",
    symptoms: v.symptoms ?? "",
    note: v.notes ?? "",
    rxAttached: attachments.some((a) => a.type === "photo" || a.type === "digital"),
    rxDigital: attachments.some((a) => a.type === "digital"),
    recordingAttached: attachments.some((a) => a.type === "audio"),
    followUpOn: v.followUpDate ?? undefined,
    attachments,
  };
}

// ─── Thread / ChatMsg ─────────────────────────────────────────────────────────

export interface ApiThread {
  id: string;
  patientId?: string | null;
  status: "open" | "escalated" | "closed";
  unreadCount?: number | null;
  lastMessageAt?: string | null;
  triage?: string | null;
  aiSummary?: string | null;
  doctorId?: string | null;
  scope?: "general" | "booking" | null;
  appointmentId?: string | null;
}

const VALID_TRIAGE: Triage[] = ["critical", "moderate", "routine"];

// lastMessageAt has no home in src/lib/types.ts's Thread — the list endpoint
// doesn't return message previews (only GET /:id/messages does, too expensive
// to fetch per-row in a list), so it rides along as an extra field.
export type AdaptedThread = Thread & { lastMessageAt?: string };

export function fromApiThread(t: ApiThread, messages: ChatMsg[] = []): AdaptedThread {
  return {
    id: t.id,
    patientId: t.patientId ?? "",
    lastMessageAt: t.lastMessageAt ?? undefined,
    // paid still has no backend column — still defaults. doctorId/scope/
    // appointmentId are real now (Phase 4's Thread.doctorId/scope/appointmentId).
    // triage/aiSummary are real now (webhooks-twilio.js classifies on inbound
    // and stamps the Thread row); "routine"/"" cover a thread from before
    // that was wired up, or one the classifier hasn't reached yet.
    doctorId: t.doctorId ?? "",
    scope: t.scope ?? "general",
    appointmentId: t.appointmentId ?? undefined,
    triage: t.triage && VALID_TRIAGE.includes(t.triage as Triage) ? (t.triage as Triage) : "routine",
    unread: t.unreadCount ?? 0,
    paid: false,
    aiSummary: t.aiSummary ?? "",
    escalated: t.status === "escalated",
    messages,
  };
}

export interface ApiChatMsg { id: string; direction: "inbound" | "outbound"; body: string; createdAt: string; viaAI?: boolean }

export function fromApiChatMsg(m: ApiChatMsg): ChatMsg {
  const from = m.direction === "inbound" ? "patient" : m.viaAI ? "ai" : "doctor";
  return { id: m.id, from, text: m.body, at: m.createdAt };
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface ApiTask { id: string; title: string; dueAt?: string | null; status: "open" | "done"; viaAI?: boolean }

export function fromApiTask(t: ApiTask): Task {
  return { id: t.id, text: t.title, due: t.dueAt ?? undefined, done: t.status === "done", viaAI: t.viaAI ?? false };
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export interface ApiInvoice {
  id: string;
  createdAt: string;
  patientId?: string | null;
  amountInr: number;
  provider?: string | null;
  status: "pending" | "paid" | "failed" | "refunded";
}

export function fromApiInvoice(i: ApiInvoice): Invoice {
  return {
    id: i.id,
    at: i.createdAt,
    patientId: i.patientId ?? "",
    amount: i.amountInr,
    mode: i.provider === "cash" ? "cash" : i.provider === "card" ? "card" : "upi",
    state: i.status === "paid" ? "paid" : "due",
  };
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  createdAt: string;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  readAt?: string | null;
}

export function fromApiNotification(n: ApiNotification): Notif {
  const text = [n.title, n.body].filter(Boolean).join(": ") || n.body || n.title || "";
  return {
    id: n.id,
    at: n.createdAt,
    kind: (n.type as Notif["kind"]) ?? "system",
    text,
    read: n.readAt != null,
  };
}

// ─── CallLog / WaLog ──────────────────────────────────────────────────────────

export interface ApiCallLog {
  id: string; createdAt: string; name?: string | null; phone: string; lang?: string | null;
  durationSec: number; outcome: CallLog["outcome"]; summary?: string | null;
}

export function fromApiCallLog(c: ApiCallLog): CallLog {
  return {
    id: c.id, at: c.createdAt, name: c.name ?? "Unknown caller", phone: c.phone,
    lang: c.lang ?? "—", durationSec: c.durationSec, outcome: c.outcome, summary: c.summary ?? "",
  };
}

export interface ApiWaLog { id: string; createdAt: string; direction: "inbound" | "outbound"; payload?: Record<string, unknown> | null }

export function fromApiWaLog(w: ApiWaLog): WaLog {
  const payload = w.payload ?? {};
  const body = typeof payload.body === "string" ? payload.body : JSON.stringify(payload);
  return {
    id: w.id,
    at: w.createdAt,
    name: (payload.name as string) ?? "Unknown",
    phone: (payload.toPhone as string) ?? (payload.phone as string) ?? "",
    // WaLog is a raw send/webhook audit trail on the backend, not yet tagged
    // by message kind — defaults to "booking" until that's added server-side.
    kind: "booking",
    preview: body.slice(0, 80),
  };
}

// ─── DayStat ──────────────────────────────────────────────────────────────────

export interface ApiDayStat { day: string; appointments: number; revenue: number; cancellations: number }

export function fromApiDayStat(d: ApiDayStat): DayStat {
  const date = new Date(d.day);
  return {
    date: d.day,
    label: date.toLocaleDateString("en-IN", { weekday: "short" }),
    appointments: d.appointments,
    revenue: Number(d.revenue ?? 0),
    // day_stats tracks cancellations, not no-shows specifically — closest
    // available proxy until a dedicated no-show column exists.
    noShows: d.cancellations,
  };
}

// ─── Clinic settings ────────────────────────────────────────────────────────

export function fromApiClinicSettings(settings: Partial<Settings> | null | undefined): Settings {
  return {
    captureMode: settings?.captureMode ?? "recap",
    receptionAnalytics: settings?.receptionAnalytics ?? false,
    aiAssistant: settings?.aiAssistant ?? true,
    billing: settings?.billing ?? false,
    digitalRx: settings?.digitalRx ?? true,
    autoFollowUp: settings?.autoFollowUp ?? true,
    viewMode: settings?.viewMode ?? "simple",
    // Previously silently dropped here — the backend has round-tripped this
    // fine since the Twilio/WhatsApp automation work, there was just no
    // frontend type for it until the Automations settings page.
    communication: settings?.communication ?? { channelsEnabled: [], voiceGreetingTemplate: null, workflows: [] },
  };
}
