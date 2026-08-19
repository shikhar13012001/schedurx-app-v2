"use client";

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { api } from "@/lib/api-client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return client;
}

type QueueSubscription = {
  listeners: Set<() => void>;
  ready: Promise<RealtimeChannel | null>;
};

// Keyed by clinicId, shared across every caller — Supabase's client reuses
// the same channel object for a given topic name (`realtime:queue:${clinicId}`),
// and calling `.on()` a second time on an already-subscribed channel throws
// ("cannot add postgres_changes callbacks... after subscribe()"). Since
// multiple components on one page (e.g. NowServing + QueueList) each mount
// useQueue(), they must share one underlying channel + subscription instead
// of each trying to create/subscribe their own.
const subscriptions = new Map<string, QueueSubscription>();

async function createQueueChannel(clinicId: string, entry: QueueSubscription): Promise<RealtimeChannel | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { token } = await api.get<{ token: string }>("/api/v1/realtime-token");
    await supabase.realtime.setAuth(token);
  } catch {
    // 501 (SUPABASE_JWT_SECRET unset) or any transient failure — Realtime is
    // a progressive enhancement here, the 30s poll in useQueue is the fallback.
    return null;
  }

  return supabase
    .channel(`queue:${clinicId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "QueueItem", filter: `clinicId=eq.${clinicId}` },
      () => entry.listeners.forEach((listener) => listener()),
    )
    .subscribe();
}

// Registers `onChange` against the shared channel for `clinicId`, creating it
// on first use. Returns an unsubscribe function; the underlying channel is
// torn down once the last listener for that clinic unsubscribes.
export function subscribeToQueue(clinicId: string, onChange: () => void): () => void {
  let entry = subscriptions.get(clinicId);
  if (!entry) {
    entry = { listeners: new Set(), ready: null as unknown as Promise<RealtimeChannel | null> };
    entry.ready = createQueueChannel(clinicId, entry);
    subscriptions.set(clinicId, entry);
  }
  entry.listeners.add(onChange);
  const capturedEntry = entry;

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    capturedEntry.listeners.delete(onChange);
    // Deferred: React StrictMode (dev) unmounts and immediately remounts
    // effects synchronously — give a remount a chance to re-add a listener
    // to this same entry before actually tearing the channel down, so a
    // fast remount doesn't race a second subscribe() for the same topic
    // against this one's still-in-flight setup.
    setTimeout(() => {
      if (capturedEntry.listeners.size > 0) return;
      if (subscriptions.get(clinicId) !== capturedEntry) return;
      subscriptions.delete(clinicId);
      capturedEntry.ready.then((channel) => {
        if (channel) getSupabase()?.removeChannel(channel);
      });
    }, 0);
  };
}
