"use client";
import { useEffect } from "react";

// Minimal shape of the non-standard `beforeinstallprompt` event — not in
// TS lib.dom, so this is hand-typed rather than `any`.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __srxInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Not user-actionable (nothing to retry/toast) but shouldn't be
        // completely invisible either — push/install features silently
        // degrade without this, worth a trace in dev tools.
        console.warn("[sw-register] service worker registration failed", err);
      });
    }
    const handler = (e: Event) => {
      e.preventDefault();
      window.__srxInstallPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event("srx-installable"));
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  return null;
}
