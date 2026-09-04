"use client";

// Thin bridge to the schedurx-apk-app's custom MissedCallPlugin (Kotlin) —
// see that repo's android/app/src/main/java/com/schedurx/app/missedcall/.
// Every function here is a safe no-op when this page isn't running inside
// the Capacitor shell (i.e. the ordinary web dashboard), so nothing in this
// file needs its own "are we native" gate at every call site.
//
// @capacitor/core is a tiny, web-safe package — Capacitor.isNativePlatform()
// simply returns false outside a native shell, so importing it here doesn't
// change anything about the plain web app.

import { Capacitor } from "@capacitor/core";

export interface MissedCallPermissionResult {
  granted: boolean;
}
export interface MissedCallDeviceInfo {
  manufacturer: string;
  model: string;
  sdkInt: number;
}

// Matches the Kotlin plugin's @CapacitorPlugin(name = "MissedCall") methods —
// there's no npm-published type for a local (non-npm) plugin, so this
// interface is hand-kept in sync with MissedCallPlugin.kt.
interface MissedCallPluginApi {
  checkPermissions(): Promise<{ callDetection: string }>;
  requestCallDetectionPermissions(): Promise<MissedCallPermissionResult>;
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  openAppSettings(): Promise<void>;
  getDeviceInfo(): Promise<MissedCallDeviceInfo>;
  isEnabled(): Promise<{ enabled: boolean }>;
  setEnabled(opts: { enabled: boolean }): Promise<void>;
  cacheAuthToken(opts: { idToken: string | null }): Promise<void>;
  syncWhitelist(opts: { numbers: string[] }): Promise<void>;
  setBackendOrigin(opts: { origin: string }): Promise<void>;
}

export function isNativeShell(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

function plugin(): MissedCallPluginApi | null {
  if (!isNativeShell()) return null;
  return (Capacitor as unknown as { Plugins: Record<string, unknown> }).Plugins.MissedCall as MissedCallPluginApi;
}

export const nativeMissedCall = {
  async checkPermissions() {
    return (await plugin()?.checkPermissions()) ?? null;
  },
  async requestPermissions(): Promise<MissedCallPermissionResult | null> {
    return (await plugin()?.requestCallDetectionPermissions()) ?? null;
  },
  async isIgnoringBatteryOptimizations(): Promise<boolean | null> {
    const result = await plugin()?.isIgnoringBatteryOptimizations();
    return result?.ignoring ?? null;
  },
  async requestIgnoreBatteryOptimizations() {
    await plugin()?.requestIgnoreBatteryOptimizations();
  },
  async openAppSettings() {
    await plugin()?.openAppSettings();
  },
  async getDeviceInfo(): Promise<MissedCallDeviceInfo | null> {
    return (await plugin()?.getDeviceInfo()) ?? null;
  },
  async isEnabled(): Promise<boolean | null> {
    const result = await plugin()?.isEnabled();
    return result?.enabled ?? null;
  },
  async setEnabled(enabled: boolean) {
    await plugin()?.setEnabled({ enabled });
  },
  // Called from AuthSync (providers.tsx) on every onIdTokenChanged — a null
  // token clears the native cache on logout.
  async cacheAuthToken(idToken: string | null) {
    await plugin()?.cacheAuthToken({ idToken });
  },
  // Piggy-backs on the whitelist page's own GET fetch — see
  // useSyncNativeWhitelist in use-caller-whitelist.ts.
  async syncWhitelist(numbers: string[]) {
    await plugin()?.syncWhitelist({ numbers });
  },
  async setBackendOrigin(origin: string) {
    await plugin()?.setBackendOrigin({ origin });
  },
};
