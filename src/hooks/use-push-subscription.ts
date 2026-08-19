"use client";

import { api } from "@/lib/api-client";

// VAPID public keys are base64url — the Push API wants a raw Uint8Array.
function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw.split("").map((c) => c.charCodeAt(0)));
}

// Subscribes this browser to real Web Push and hands the subscription to the
// backend (POST /api/v1/push-subscriptions, already real). Call this only
// after Notification.requestPermission() has actually granted permission —
// pushManager.subscribe() throws otherwise.
export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "Push isn't supported in this browser." };
  }
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, reason: "Push isn't configured for this deployment." };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await api.post("/api/v1/push-subscriptions", { subscription: subscription.toJSON() });
  return { ok: true };
}
