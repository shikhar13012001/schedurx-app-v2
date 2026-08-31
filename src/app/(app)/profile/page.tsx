"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Download, FileText, LogOut, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useSession, useTheme, useClinic, type Settings, type ThemeId, type Mode } from "@/stores";
import { useDoctors, useUpdateDoctor } from "@/hooks/use-team";
import { useClinicProfile } from "@/hooks/use-clinic-profile";
import { subscribeToPush } from "@/hooks/use-push-subscription";
import { api, ApiError } from "@/lib/api-client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import { Input, Field } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const THEMES: { id: ThemeId; name: string; hint: string; preview: string }[] = [
  { id: "evergreen", name: "Warm light", hint: "Off-white, stone and orange.", preview: "linear-gradient(135deg,#B9B6B1 8%,#F7F7F7 52%,#EC6B25 120%)" },
  { id: "sage", name: "Soft stone", hint: "A slightly quieter neutral field.", preview: "linear-gradient(135deg,#C5C0B9,#F7F7F7 68%,#EC6B25 135%)" },
  { id: "graphite", name: "Graphite", hint: "Sharper charcoal contrast.", preview: "linear-gradient(135deg,#181818,#393633 62%,#EC6B25 130%)" },
  { id: "dawn", name: "Dawn", hint: "Warmer cream through the canvas.", preview: "linear-gradient(135deg,#E8DED2,#F7F7F7 62%,#EC6B25 125%)" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { session, logout } = useSession();
  const { theme, mode, setTheme, setMode } = useTheme();
  const { settings, setSetting } = useClinic();
  const { data: doctors } = useDoctors();
  const updateDoctor = useUpdateDoctor();
  const { data: clinicProfile } = useClinicProfile();
  const queryClient = useQueryClient();
  const isDoctor = session?.role === "doctor";
  // Same fallback as the home page: an owner isn't necessarily linked to a
  // specific Doctor row (Staff.doctorId can be null), so fall back to the
  // clinic's first doctor rather than showing blank/unsaveable fields.
  const doctor = doctors?.find((item) => item.id === session?.doctorId) ?? doctors?.[0];
  const [canInstall, setCanInstall] = React.useState(false);
  const [fee, setFee] = React.useState<string>("");
  const [slotMinutes, setSlotMinutes] = React.useState<string>("");
  const [workingHoursStart, setWorkingHoursStart] = React.useState<string>("");
  const [workingHoursEnd, setWorkingHoursEnd] = React.useState<string>("");
  const [googleReviewUrl, setGoogleReviewUrl] = React.useState<string>("");
  const [savingReviewUrl, setSavingReviewUrl] = React.useState(false);
  const [tokenAmount, setTokenAmount] = React.useState<string>("");
  const [tokenEnabled, setTokenEnabled] = React.useState(false);
  const [savingToken, setSavingToken] = React.useState(false);

  React.useEffect(() => {
    if (clinicProfile) setGoogleReviewUrl(clinicProfile.googleReviewUrl ?? "");
  }, [clinicProfile?.googleReviewUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (clinicProfile) {
      setTokenAmount(clinicProfile.tokenAmountPaise != null ? String(Math.round(clinicProfile.tokenAmountPaise / 100)) : "");
      setTokenEnabled(clinicProfile.tokenMoneyEnabled);
    }
  }, [clinicProfile?.tokenAmountPaise, clinicProfile?.tokenMoneyEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewUrlDirty = (clinicProfile?.googleReviewUrl ?? "") !== googleReviewUrl;
  const tokenAmountPaiseValue = tokenAmount ? Math.round(Number(tokenAmount) * 100) : null;
  const tokenDirty =
    !!clinicProfile &&
    (tokenEnabled !== clinicProfile.tokenMoneyEnabled || tokenAmountPaiseValue !== (clinicProfile.tokenAmountPaise ?? null));

  async function saveGoogleReviewUrl() {
    if (!reviewUrlDirty) return;
    setSavingReviewUrl(true);
    try {
      await api.patch("/api/v1/clinic", { googleReviewUrl: googleReviewUrl.trim() || null });
      await queryClient.invalidateQueries({ queryKey: ["clinic-profile"] });
      toast.success("Review link saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save the review link");
    } finally {
      setSavingReviewUrl(false);
    }
  }

  // This clinic-level amount is what the booking sheet's "Lock slot with
  // token" toggle actually charges — a completely separate field from a
  // doctor's own consultation Fee below, which a booking never reads for
  // this purpose. Saving with the toggle on but no amount set is refused
  // client-side so a clinic can't end up in the same "token requested, no
  // amount configured" state that broke booking earlier.
  async function saveToken() {
    if (!tokenDirty) return;
    if (tokenEnabled && !tokenAmountPaiseValue) {
      toast.error("Enter a token amount before turning this on.");
      return;
    }
    setSavingToken(true);
    try {
      await api.patch("/api/v1/clinic", { tokenMoneyEnabled: tokenEnabled, tokenAmountPaise: tokenEnabled ? tokenAmountPaiseValue : null });
      await queryClient.invalidateQueries({ queryKey: ["clinic-profile"] });
      toast.success("Token settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save token settings");
    } finally {
      setSavingToken(false);
    }
  }

  // Sync from the server only when the *doctor identity* changes (initial
  // load, or switching to a different doctor's record) — never when just
  // doctor.fee/slotMinutes change. Those also change right after a
  // successful save (the mutation invalidates and refetches this same
  // doctor), and re-syncing on every value change meant that refetch could
  // land mid-edit and silently overwrite whatever was being typed, with
  // further keystrokes then appending onto the reset value instead of
  // replacing it (how a slot length ends up looking like "300").
  React.useEffect(() => {
    if (doctor) {
      setFee(String(doctor.fee));
      setSlotMinutes(String(doctor.slotMinutes));
      setWorkingHoursStart(doctor.workingHoursStart);
      setWorkingHoursEnd(doctor.workingHoursEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor?.id]);

  const feeValue = Number(fee);
  const slotValue = Number(slotMinutes);
  const hoursValid = /^\d{2}:\d{2}$/.test(workingHoursStart) && /^\d{2}:\d{2}$/.test(workingHoursEnd) && workingHoursStart < workingHoursEnd;
  const practiceDirty = !!doctor && (
    (Number.isFinite(feeValue) && feeValue !== doctor.fee) ||
    (Number.isFinite(slotValue) && slotValue > 0 && slotValue !== doctor.slotMinutes) ||
    (hoursValid && (workingHoursStart !== doctor.workingHoursStart || workingHoursEnd !== doctor.workingHoursEnd))
  );

  function savePractice() {
    if (!doctor || !practiceDirty) return;
    if ((workingHoursStart !== doctor.workingHoursStart || workingHoursEnd !== doctor.workingHoursEnd) && !hoursValid) {
      toast.error("Start time must be before end time.");
      return;
    }
    const patch: { feeInr?: number; slotDurationOverrideMins?: number; workingHoursStart?: string; workingHoursEnd?: string } = {};
    if (Number.isFinite(feeValue) && feeValue !== doctor.fee) patch.feeInr = feeValue;
    if (Number.isFinite(slotValue) && slotValue > 0 && slotValue !== doctor.slotMinutes) patch.slotDurationOverrideMins = slotValue;
    if (hoursValid && workingHoursStart !== doctor.workingHoursStart) patch.workingHoursStart = workingHoursStart;
    if (hoursValid && workingHoursEnd !== doctor.workingHoursEnd) patch.workingHoursEnd = workingHoursEnd;
    updateDoctor.mutate({ doctorId: doctor.id, patch }, {
      onSuccess: () => toast.success("Practice details saved"),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't save changes"),
    });
  }

  // Only the clinic owner can write settings (backend: requireRole("owner"));
  // any other signed-in staff gets a 403 and the optimistic update rolls back —
  // surface that instead of failing silently.
  function trySetting<K extends keyof Settings>(k: K, v: Settings[K]) {
    setSetting(k, v).catch((err) => {
      toast.error(err instanceof ApiError && err.status === 403 ? "Only the clinic owner can change this." : "Couldn't save that setting.");
    });
  }

  React.useEffect(() => {
    setCanInstall(Boolean(window.__srxInstallPrompt));
    const handler = () => setCanInstall(true);
    window.addEventListener("srx-installable", handler);
    return () => window.removeEventListener("srx-installable", handler);
  }, []);

  if (!session) return null;

  async function install() {
    const prompt = window.__srxInstallPrompt;
    if (!prompt) {
      toast.info("Already installed, or use your browser menu → Add to Home Screen.");
      return;
    }
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") toast.success("ScheduRx installed. Find it on your home screen.");
  }

  async function enableNotifs() {
    if (!("Notification" in window)) return toast.error("Notifications aren’t supported here.");
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      toast.info("You can enable notifications later from browser settings.");
      return;
    }
    try {
      const subscribed = await subscribeToPush();
      if (subscribed.ok === false) throw new Error(subscribed.reason);
      toast.success("Critical-case alerts enabled.");
      try { new Notification("ScheduRx", { body: "You’ll be pinged the moment AI flags a critical case." }); } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't subscribe.");
    }
  }

  return (
    <div className="stagger mx-auto max-w-2xl space-y-9">
      <header>
        <div className="flex items-start gap-4">
          <Avatar id={session.doctorId ?? session.name} name={session.name} size={68} ring />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[12px] text-muted">Profile</p>
            <h1 className="mt-1 text-balance font-display text-[clamp(2.4rem,9.5vw,3.8rem)] font-light leading-[0.96] tracking-[-0.055em]">{session.name}</h1>
            <p className="mt-2 text-[13px] text-muted">{isDoctor ? `${doctor?.specialty ?? "Doctor"} · ${session.clinicName}` : `Front desk · ${session.clinicName}`}</p>
          </div>
          <button onClick={() => { logout(); router.replace("/"); }} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Log out"><LogOut size={17} /></button>
        </div>
      </header>

      <SettingGroup title="Experience">
        <SettingRow title="View" hint={settings.viewMode === "advanced" ? "Full operational detail." : "Only what matters right now."}>
          <Segmented value={settings.viewMode ?? "simple"} onChange={(value) => trySetting("viewMode", value as "simple" | "advanced")} options={[{ value: "simple", label: "Simple" }, { value: "advanced", label: "Advanced" }]} />
        </SettingRow>
      </SettingGroup>

      <section>
        <p className="mb-3 px-1 text-[12px] text-muted">Appearance</p>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((item) => (
            <button key={item.id} onClick={() => { setTheme(item.id); toast(`${item.name} selected.`); }} className={cn("pressable min-h-[140px] rounded-panel bg-surface p-3 text-left shadow-card", theme === item.id && "ring-2 ring-primary/30")}> 
              <div className="relative h-16 rounded-[22px]" style={{ background: item.preview }}>{theme === item.id && <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-charcoal"><Check size={14} /></span>}</div>
              <p className="mt-3 text-[13px] font-medium">{item.name}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{item.hint}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-panel bg-surface px-5 py-4 shadow-card"><SettingRow title="Mode" hint="Light is the hero experience."><Segmented value={mode} onChange={(value) => setMode(value as Mode)} options={[{ value: "light", label: "Light" }, { value: "system", label: "Auto" }, { value: "dark", label: "Dark" }]} /></SettingRow></div>
      </section>

      {isDoctor && (
        <SettingGroup title="Clinical">
          <ToggleRow title="Auto follow-up detection" hint='Understands phrases like “see me in two weeks”.' checked={settings.autoFollowUp} onChange={(value) => trySetting("autoFollowUp", value)} />
          <ToggleRow title="AI assistant" hint="Block time, find history and create tasks." checked={settings.aiAssistant} onChange={(value) => trySetting("aiAssistant", value)} icon={<Sparkles size={14} />} />
        </SettingGroup>
      )}

      {isDoctor && (
        <SettingGroup title="Practice">
          <ToggleRow title="Digital prescriptions" hint="Generate letterhead PDFs; otherwise attach a photo." checked={settings.digitalRx} onChange={(value) => trySetting("digitalRx", value)} />
          <ToggleRow title="Billing & invoices" hint="Track payments, tokens and invoices." checked={settings.billing} onChange={(value) => trySetting("billing", value)} icon={<Wallet size={14} />} />
          {settings.billing && (
            <div className="border-t border-border/60 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium">Lock slot with token</p>
                  <p className="mt-1 max-w-[360px] text-[11.5px] leading-relaxed text-muted">
                    A booking-sheet toggle staff use per patient — this is the amount it actually charges, separate from a doctor&apos;s consultation Fee below.
                  </p>
                </div>
                <Switch checked={tokenEnabled} onCheckedChange={setTokenEnabled} />
              </div>
              {tokenEnabled && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Token amount (₹)"><Input value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></Field>
                </div>
              )}
              <Button size="sm" className="mt-4 w-full sm:w-auto" disabled={!tokenDirty || savingToken} onClick={saveToken}>
                {savingToken ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
          <ToggleRow title="Reception analytics" hint="Allow front desk access to practice metrics." checked={settings.receptionAnalytics} onChange={(value) => trySetting("receptionAnalytics", value)} />
          <div className="border-t border-border/60 pt-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Fee (₹)"><Input value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></Field>
              <Field label="Slot (min)" hint="Sets the time increments patients can be booked at"><Input value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></Field>
              <Field label="Registration no."><Input defaultValue={doctor?.regNo ?? ""} /></Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Working hours start" hint="What time you're bookable from — the calendar and booking form both follow this">
                <Input type="time" value={workingHoursStart} onChange={(e) => setWorkingHoursStart(e.target.value)} />
              </Field>
              <Field label="Working hours end">
                <Input type="time" value={workingHoursEnd} onChange={(e) => setWorkingHoursEnd(e.target.value)} />
              </Field>
            </div>
            <Button size="sm" className="mt-4 w-full sm:w-auto" disabled={!practiceDirty || updateDoctor.isPending} onClick={savePractice}>
              {updateDoctor.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
          <div className="border-t border-border/60 pt-5">
            <Field label="Google review link" hint="Sent to patients after a visit — shows up wherever a workflow message references it.">
              <Input value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/r/…/review" />
            </Field>
            <Button size="sm" className="mt-4 w-full sm:w-auto" disabled={!reviewUrlDirty || savingReviewUrl} onClick={saveGoogleReviewUrl}>
              {savingReviewUrl ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SettingGroup>
      )}

      <SettingGroup title="Application">
        <RowButton icon={<Download size={16} />} label={canInstall ? "Install ScheduRx" : "Add to home screen"} onClick={install} />
        <RowButton icon={<Bell size={16} />} label="Enable critical-case alerts" onClick={enableNotifs} />
        <RowButton icon={<FileText size={16} />} label="Privacy & terms" onClick={() => toast.info("DPDP-compliant. Patient data stays in India. Full policy ships with production.")} />
      </SettingGroup>

      <p className="pb-2 text-center text-[10.5px] text-faint">ScheduRx · Preview build · Made for Indian clinics</p>
    </div>
  );
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><p className="mb-3 px-1 text-[12px] text-muted">{title}</p><div className="divide-y divide-border/60 rounded-panel bg-surface px-5 shadow-card">{children}</div></section>;
}

function SettingRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[14px] font-medium">{title}</p><p className="mt-1 max-w-[360px] text-[11.5px] leading-relaxed text-muted">{hint}</p></div><div className="shrink-0">{children}</div></div>;
}

function ToggleRow({ title, hint, icon, checked, onChange }: { title: string; hint: string; icon?: React.ReactNode; checked: boolean; onChange: (value: boolean) => void }) {
  return <SettingRow title={title} hint={hint}><div className="flex items-center gap-2">{icon && <span className="text-muted">{icon}</span>}<Switch checked={checked} onCheckedChange={onChange} /></div></SettingRow>;
}

function RowButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-[62px] w-full items-center gap-3 py-3 text-left text-[13px] transition-opacity hover:opacity-70"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft text-muted">{icon}</span><span>{label}</span></button>;
}
