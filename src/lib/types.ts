export type Role = "doctor" | "receptionist";
export type ClinicType = "solo" | "polyclinic";

export interface Doctor {
  id: string; name: string; specialty: string; fee: number; slotMinutes: number;
  regNo: string; availableNow: boolean; todayHours: string; bio?: string;
}
export interface Staff { id: string; name: string; role: Role; email: string; doctorId?: string; onlineNow: boolean; }

export type VisitMode = "clinic" | "video" | "audio" | "text";
export interface Visit {
  id: string; date: string; doctorId: string; mode: VisitMode;
  symptoms: string; note: string; rxAttached?: boolean; rxDigital?: boolean; followUpOn?: string;
}
export type ReviewState = "given" | "link_sent" | "none";
export interface Patient {
  id: string; name: string; phone: string; age: number; gender: "M" | "F" | "O";
  email?: string; tags: string[]; review: ReviewState; visits: Visit[];
}

export type ApptStatus = "confirmed" | "tentative" | "waitlist" | "completed" | "no_show" | "cancelled" | "blocked";
export type ApptSource = "ai_call" | "whatsapp" | "web" | "walk_in" | "reception";
export type PayState = "token" | "full" | "unpaid";
export interface Appointment {
  id: string; patientId?: string; doctorId: string; startsAt: string; durationMin: number;
  status: ApptStatus; source: ApptSource; pay: PayState; mode: VisitMode;
  symptoms?: string; critical?: boolean; meetLink?: string; blockReason?: string;
}

export type QueueState = "waiting" | "in_room" | "done";
export interface QueueItem { id: string; apptId?: string; patientId: string; doctorId: string; state: QueueState; walkIn?: boolean; arrivedAt?: string; }

export type Triage = "critical" | "moderate" | "routine";
export interface ChatMsg { id: string; from: "patient" | "doctor" | "ai"; text: string; at: string; }
export interface Thread {
  id: string; patientId: string; doctorId: string; triage: Triage; unread: number;
  paid: boolean; aiSummary: string; escalated?: boolean; messages: ChatMsg[];
  // Phase 4: a thread tied to one specific booking (vs. a general,
  // phone-resolved conversation) — see api-v1-threads.js's doctor isolation.
  scope?: "general" | "booking"; appointmentId?: string;
}

export interface CallLog { id: string; at: string; name: string; phone: string; lang: string; durationSec: number; outcome: "booked" | "rescheduled" | "reminder_confirmed" | "info" | "recovered_missed"; summary: string; }
export interface WaLog { id: string; at: string; name: string; phone: string; kind: "booking" | "reminder" | "follow_up" | "review_link" | "rx_sent"; preview: string; }

export type NotifKind = "critical" | "reminder" | "booking" | "review" | "waitlist" | "system";
export interface Notif { id: string; at: string; kind: NotifKind; text: string; read: boolean; }

export interface Task { id: string; text: string; due?: string; done: boolean; viaAI?: boolean; }

export interface DayStat { date: string; label: string; appointments: number; revenue: number; noShows: number; }
export interface Invoice { id: string; at: string; patientId: string; amount: number; mode: "upi" | "cash" | "card"; state: "paid" | "due"; }
