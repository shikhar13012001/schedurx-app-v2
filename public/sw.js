/* ScheduRx service worker — app-shell cache + offline fallback + push demo */
const CACHE = "srx-v1";
const SHELL = ["/", "/home", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Every authenticated /api/* response (appointments, patients, visits,
// messages, call logs — all real PHI) was being written into Cache Storage
// here with no exclusion and never cleared on logout, so it stayed readable
// from the cache indefinitely afterward — a real exposure risk on a shared
// clinic device. Only same-origin static shell/asset GETs go through the
// cache-then-network path now; anything under /api/ (dashboard) or
// /webhooks/, /internal/ (would only ever be same-origin here by accident)
// is always network-only and never written to Cache Storage.
const NEVER_CACHE_PREFIXES = ["/api/", "/webhooks/", "/internal/"];

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  const path = new URL(e.request.url).pathname;
  if (NEVER_CACHE_PREFIXES.some((p) => path.startsWith(p))) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("/home")))
  );
});

// Lets page code request a full wipe of this cache on logout/account switch
// (see sw-register.tsx) — belt-and-suspenders alongside the /api/ exclusion
// above, since it also clears anything cached by an older service worker
// version from before that exclusion existed.
self.addEventListener("message", (e) => {
  if (e.data?.type === "CLEAR_CACHE") {
    e.waitUntil(caches.delete(CACHE));
  }
});
self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : { title: "ScheduRx", body: "You have a new update." };
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow("/consults"));
});
