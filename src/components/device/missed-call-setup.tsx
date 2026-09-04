"use client";

import { useEffect, useState } from "react";
import { PhoneMissed, ShieldCheck, BatteryCharging, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isNativeShell, nativeMissedCall } from "@/lib/native-missed-call";

// Manufacturers known to aggressively kill background receivers/services —
// the single biggest real-world reliability risk for the missed-call safety
// net, per the build brief. No single cross-OEM API surfaces their
// autostart/battery settings screen, so this is a "here's where to look"
// help card rather than a deep link.
const OEM_HELP: Record<string, string> = {
  xiaomi: "Open Security app → Permissions → Autostart, and turn ScheduRx on. Also check Battery saver → App battery saver → ScheduRx → No restrictions.",
  redmi: "Open Security app → Permissions → Autostart, and turn ScheduRx on. Also check Battery saver → App battery saver → ScheduRx → No restrictions.",
  poco: "Open Security app → Permissions → Autostart, and turn ScheduRx on. Also check Battery saver → App battery saver → ScheduRx → No restrictions.",
  vivo: "Open iManager → App manager → Autostart, and turn ScheduRx on.",
  oppo: "Open Settings → Battery → App battery management → ScheduRx, and allow background activity.",
  oneplus: "Open Settings → Battery → Battery optimization → ScheduRx → Don't optimize.",
  realme: "Open Settings → App management → ScheduRx → Battery usage, and allow background activity.",
};

type Step = "loading" | "off" | "needs-permission" | "permission-denied" | "needs-battery" | "on";

// Only renders anything inside the Capacitor shell — the ordinary web
// dashboard (the overwhelming majority of sessions) never sees this card.
// Reuses the exact SettingGroup/RowButton visual language from profile/page.tsx
// rather than importing those (they're local to that file), so this stays a
// self-contained, drop-in section.
export function MissedCallDeviceSetup() {
  const [native, setNative] = useState(false);
  const [step, setStep] = useState<Step>("loading");
  const [manufacturer, setManufacturer] = useState<string | null>(null);

  useEffect(() => {
    setNative(isNativeShell());
  }, []);

  useEffect(() => {
    if (!native) return;
    void refreshStatus();
  }, [native]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshStatus() {
    const enabled = await nativeMissedCall.isEnabled();
    if (enabled) {
      setStep("on");
      return;
    }
    const perms = await nativeMissedCall.checkPermissions();
    const granted = (perms as { callDetection?: string } | null)?.callDetection === "granted";
    if (!granted) {
      setStep("off");
      return;
    }
    const ignoringBattery = await nativeMissedCall.isIgnoringBatteryOptimizations();
    setStep(ignoringBattery ? "on" : "needs-battery");
    if (ignoringBattery) await nativeMissedCall.setEnabled(true);
  }

  async function enable() {
    setStep("needs-permission");
    const result = await nativeMissedCall.requestPermissions();
    if (!result?.granted) {
      setStep("permission-denied");
      return;
    }
    const info = await nativeMissedCall.getDeviceInfo();
    if (info) setManufacturer(info.manufacturer.toLowerCase());
    const ignoringBattery = await nativeMissedCall.isIgnoringBatteryOptimizations();
    if (ignoringBattery) {
      await nativeMissedCall.setEnabled(true);
      setStep("on");
      toast.success("Missed-call detection is on");
    } else {
      setStep("needs-battery");
    }
  }

  async function allowBackground() {
    await nativeMissedCall.requestIgnoreBatteryOptimizations();
    // The system dialog is async/modal outside our control — re-check on
    // return rather than assuming it was granted.
    const ignoringBattery = await nativeMissedCall.isIgnoringBatteryOptimizations();
    if (ignoringBattery) {
      await nativeMissedCall.setEnabled(true);
      setStep("on");
      toast.success("Missed-call detection is on");
    }
  }

  async function toggleOff(checked: boolean) {
    if (checked) return; // turning back on goes through enable() instead, to re-verify permissions
    await nativeMissedCall.setEnabled(false);
    setStep("off");
  }

  if (!native) return null;

  const oemTip = manufacturer ? Object.entries(OEM_HELP).find(([key]) => manufacturer.includes(key))?.[1] : null;

  return (
    <section>
      <p className="mb-3 px-1 text-[12px] text-muted">Missed-call detection</p>
      <div className="space-y-3 rounded-panel bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink"><PhoneMissed size={16} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">Missed calls on this phone</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              When a call to this phone goes unanswered from a number that isn&apos;t a saved contact, ScheduRx reports it and sends the same follow-up text patients get from a forwarded call.
            </p>
          </div>
        </div>

        {step === "on" && (
          <div className="flex items-center justify-between rounded-[18px] bg-surface-soft px-4 py-3">
            <span className="flex items-center gap-2 text-[13px] font-medium"><ShieldCheck size={15} className="text-primary" /> On</span>
            <Switch checked={true} onCheckedChange={toggleOff} />
          </div>
        )}

        {(step === "off" || step === "loading") && (
          <Button size="sm" className="w-full" disabled={step === "loading"} onClick={enable}>
            Turn on missed-call detection
          </Button>
        )}

        {step === "needs-permission" && <p className="text-center text-[12.5px] text-faint">Waiting for permission…</p>}

        {step === "permission-denied" && (
          <div className="space-y-2">
            <p className="text-[12.5px] text-danger">
              Call log, contacts, and phone-state permissions are required. If you accidentally chose &quot;Don&apos;t ask again&quot;, enable them from system settings.
            </p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => nativeMissedCall.openAppSettings()}>
              <Settings2 size={14} /> Open app settings
            </Button>
          </div>
        )}

        {step === "needs-battery" && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[12.5px] text-muted"><BatteryCharging size={15} className="text-primary" /> One more step — allow ScheduRx to run in the background, or your phone may stop detecting calls after a while.</p>
            <Button size="sm" className="w-full" onClick={allowBackground}>Allow background activity</Button>
            {oemTip && <p className="rounded-[18px] bg-surface-soft px-4 py-3 text-[11.5px] leading-relaxed text-muted">{oemTip}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
