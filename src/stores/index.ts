"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { signOut } from "firebase/auth";
import { ClinicType, Role } from "@/lib/types";
import { getFirebaseAuth } from "@/lib/firebase";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";

/* ------------------------------ SESSION ------------------------------ */
export type Session = {
  name: string; email: string; role: Role; doctorId?: string;
  clinicName: string; clinicType: ClinicType;
  // Real-auth fields — clinicId/staffId come from the backend's resolved
  // Firebase custom claims (GET /api/v1/me), not the client.
  clinicId: string; firebaseUid: string; staffId: string;
};
type SessionStore = {
  session: Session | null;
  onboarded: boolean;
  hydrated: boolean;
  login: (s: Session) => void;
  logout: () => void;
  setOnboarded: (b: boolean) => void;
  setHydrated: () => void;
};
export const useSession = create<SessionStore>()(
  persist(
    (set) => ({
      session: null, onboarded: true, hydrated: false,
      login: (session) => set({ session }),
      logout: () => { void signOut(getFirebaseAuth()); queryClient.clear(); set({ session: null }); },
      setOnboarded: (onboarded) => set({ onboarded }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "srx-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ session: s.session, onboarded: s.onboarded }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);

/* ------------------------------ THEME ------------------------------ */
export type ThemeId = "evergreen" | "sage" | "graphite" | "dawn";
export type Mode = "system" | "light" | "dark";
type ThemeStore = { theme: ThemeId; mode: Mode; setTheme: (t: ThemeId) => void; setMode: (m: Mode) => void };
export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({ theme: "evergreen", mode: "light", setTheme: (theme) => set({ theme }), setMode: (mode) => set({ mode }) }),
    { name: "srx-theme", storage: createJSONStorage(() => localStorage) }
  )
);

/* ------------------------------ SETTINGS ------------------------------ */
export type CommTrigger =
  | "booking_confirmed" | "reminder" | "reschedule" | "cancellation"
  | "pre_appointment" | "post_appointment" | "review_request" | "missed_call_followup";
export type CommChannel = "sms" | "whatsapp";
export type CommWorkflow = {
  id: string;
  trigger: CommTrigger;
  channel: CommChannel;
  offsetMinutes: number;
  template: string;
  enabled: boolean;
};
export type Communication = {
  channelsEnabled: CommChannel[];
  voiceGreetingTemplate: string | null;
  workflows: CommWorkflow[];
};

export type Settings = {
  captureMode: "ambient" | "recap";
  receptionAnalytics: boolean;
  aiAssistant: boolean;
  billing: boolean;
  digitalRx: boolean;
  autoFollowUp: boolean;
  viewMode: "simple" | "advanced";
  communication: Communication;
};

/* ------------------------------ CLINIC (server-backed actions + local UI state) ------------------------------ */
// List data (appointments/queue/threads/notifs/tasks) now lives in TanStack
// Query — see src/hooks/*.ts — not here. This store keeps only client-only UI
// state (capturing) and the clinic settings cache, plus every action that used
// to mutate mock arrays in place: they now call the real backend and
// invalidate the matching query so components refetch. Signatures changed
// only where the real API genuinely requires more (queue actions need
// doctorId — the backend scopes "now serving" per doctor, the mock never did).
type ClinicStore = {
  capturing: boolean;
  settings: Settings;

  next: (doctorId: string) => Promise<void>;
  prev: (doctorId: string) => Promise<void>;
  jumpTo: (doctorId: string, queueId: string) => Promise<void>;
  reorderQueue: (ids: string[]) => Promise<void>;
  addWalkIn: (p: { patientId?: string; doctorId: string; displayName?: string; phoneNumber?: string }) => Promise<void>;
  addAppointment: (input: {
    doctorId: string; start: string; end?: string; reason?: string; notes?: string; mode?: string; tokenRequested?: boolean;
    patient: { phone: string; name?: string; age?: number; gender?: string };
  }) => Promise<void>;
  blockTime: (doctorId: string, from: string, minutes: number, reason: string) => Promise<void>;
  rescheduleAppointment: (appointmentId: string, doctorId: string, newStart: string, reason?: string) => Promise<void>;
  cancelAppointment: (appointmentId: string) => Promise<void>;
  setCapturing: (b: boolean) => void;
  markThreadRead: (id: string) => Promise<void>;
  escalate: (id: string) => Promise<void>;
  reply: (id: string, text: string) => Promise<void>;
  markNotifsRead: () => Promise<void>;
  markNotifRead: (id: string) => Promise<void>;
  removeNotif: (id: string) => Promise<void>;
  addTask: (text: string, due?: string, viaAI?: boolean) => Promise<void>;
  toggleTask: (id: string, done: boolean) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => Promise<void>;
  hydrateSettings: (s: Settings) => void;
};

const DEFAULT_SETTINGS: Settings = {
  captureMode: "recap", receptionAnalytics: false, aiAssistant: true,
  billing: false, digitalRx: true, autoFollowUp: true, viewMode: "simple",
  communication: { channelsEnabled: [], voiceGreetingTemplate: null, workflows: [] },
};

function clinicId() {
  const id = useSession.getState().session?.clinicId;
  if (!id) throw new Error("No active clinic session");
  return id;
}
function invalidate(key: unknown[]) {
  return queryClient.invalidateQueries({ queryKey: key });
}

export const useClinic = create<ClinicStore>()((set, get) => ({
  capturing: false,
  settings: DEFAULT_SETTINGS,

  next: async (doctorId) => {
    await api.post("/api/v1/queue/advance", { doctorId, direction: "next" });
    await invalidate(["queue", clinicId()]);
  },
  prev: async (doctorId) => {
    await api.post("/api/v1/queue/advance", { doctorId, direction: "prev" });
    await invalidate(["queue", clinicId()]);
  },
  jumpTo: async (doctorId, queueId) => {
    await api.post("/api/v1/queue/advance", { doctorId, direction: "jumpTo", targetId: queueId });
    await invalidate(["queue", clinicId()]);
  },
  reorderQueue: async (ids) => {
    await api.patch("/api/v1/queue/order", { ids });
    await invalidate(["queue", clinicId()]);
  },
  addWalkIn: async ({ patientId, doctorId, displayName, phoneNumber }) => {
    await api.post("/api/v1/queue/walk-in", { doctorId, patientId, displayName, phoneNumber });
    await invalidate(["queue", clinicId()]);
  },
  addAppointment: async (input) => {
    await api.post("/api/v1/appointments", input);
    await invalidate(["appointments", clinicId()]);
  },
  blockTime: async (doctorId, from, minutes, reason) => {
    const end = new Date(new Date(from).getTime() + minutes * 60000).toISOString();
    await api.post("/api/v1/appointments/block", { doctorId, start: from, end, reason });
    await invalidate(["appointments", clinicId()]);
  },
  rescheduleAppointment: async (appointmentId, doctorId, newStart, reason) => {
    await api.patch(`/api/v1/appointments/${appointmentId}`, { doctorId, newStart, reason });
    await invalidate(["appointments", clinicId()]);
  },
  cancelAppointment: async (appointmentId) => {
    await api.delete(`/api/v1/appointments/${appointmentId}`);
    await invalidate(["appointments", clinicId()]);
  },
  setCapturing: (capturing) => set({ capturing }),
  markThreadRead: async (id) => {
    await api.patch(`/api/v1/threads/${id}/read`);
    await invalidate(["threads", clinicId()]);
  },
  escalate: async (id) => {
    await api.post(`/api/v1/threads/${id}/escalate`);
    await invalidate(["threads", clinicId()]);
  },
  reply: async (id, text) => {
    await api.post(`/api/v1/threads/${id}/messages`, { body: text });
    await Promise.all([invalidate(["thread-messages", clinicId(), id]), invalidate(["threads", clinicId()])]);
  },
  markNotifsRead: async () => {
    await api.patch("/api/v1/notifications/read-all");
    await invalidate(["notifications", clinicId()]);
  },
  markNotifRead: async (id) => {
    await api.patch(`/api/v1/notifications/${id}/read`);
    await invalidate(["notifications", clinicId()]);
  },
  removeNotif: async (id) => {
    await api.delete(`/api/v1/notifications/${id}`);
    await invalidate(["notifications", clinicId()]);
  },
  addTask: async (text, due, viaAI) => {
    await api.post("/api/v1/tasks", { title: text, dueAt: due, viaAI });
    await invalidate(["tasks", clinicId()]);
  },
  toggleTask: async (id, done) => {
    await api.patch(`/api/v1/tasks/${id}`, { done });
    await invalidate(["tasks", clinicId()]);
  },
  removeTask: async (id) => {
    await api.delete(`/api/v1/tasks/${id}`);
    await invalidate(["tasks", clinicId()]);
  },
  setSetting: async (k, v) => {
    const prev = get().settings;
    set({ settings: { ...prev, [k]: v } }); // optimistic
    try {
      await api.patch("/api/v1/clinic-settings", { [k]: v });
      await invalidate(["clinic-settings", clinicId()]);
    } catch (err) {
      set({ settings: prev }); // rollback
      throw err;
    }
  },
  hydrateSettings: (s) => set({ settings: s }),
}));
