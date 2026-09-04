"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Check, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PhoneField } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { WeeklySchedule, type Break } from "@/components/onboarding/weekly-schedule";
import { PhotoGrid, type DoctorPhoto } from "@/components/onboarding/photo-grid";
import { RepeatableList } from "@/components/onboarding/repeatable-list";
import { ExpandableSection } from "@/components/onboarding/expandable-section";
import { PlanPicker, type PlanId, type PlanCatalog, type AddonCatalog } from "@/components/onboarding/plan-picker";
import { CallForwardingPicker, type Carrier } from "@/components/onboarding/call-forwarding-picker";
import { TeamInviteScreen } from "@/components/onboarding/team-invite-screen";
import { useSession } from "@/stores";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithGoogleAdaptive } from "@/lib/native-google-signin";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ClinicType, Role } from "@/lib/types";

type Screen = "practice" | "you" | "clinic" | "plan" | "payment" | "calls" | "team";
const NEW_SCREENS: Screen[] = ["practice", "you", "clinic", "plan", "payment", "calls", "team"];
const INVITED_SCREENS: Screen[] = ["you"];

type OnboardingState = {
  clinic: {
    id: string; name: string; practiceType: ClinicType | null; onboardingStep: string | null; onboardingCompleted: boolean;
    phone: string | null; addressLine1: string | null; locality: string | null; city: string | null; pincode: string | null;
    workingDays: string[] | null; openingHour: number | null; closingHour: number | null;
    defaultAppointmentDurationMins: number | null; tokenMoneyEnabled: boolean; tokenAmountPaise: number | null;
    plan: { planId: PlanId; addonIds: string[] } | null;
    callForwarding: { carrier: Carrier | null; status: string } | null;
  };
  staff: { id: string; role: "doctor" | "receptionist" | "owner"; fullName: string | null; phone: string | null; onboardingStep: string | null; onboardingCompleted: boolean; workingDaysOverride: string[] | null; workingHoursStart: string | null; workingHoursEnd: string | null; breaks: Break[] | null };
  doctor: {
    id: string; fullName: string; specialty: string | null; qualification: string | null; bio: string | null; headline: string | null;
    languages: string[] | null; personalPhone: string | null; upiId: string | null; photos: DoctorPhoto[] | null;
    qualifications: Record<string, string>[] | null; registrations: Record<string, string>[] | null; affiliations: Record<string, string>[] | null;
    services: string[] | null; awards: Record<string, string>[] | null; memberships: Record<string, string>[] | null;
    consultationModes: string[] | null; additionalInfo: Record<string, string> | null;
    feeInr: number | null; slotDurationOverrideMins: number | null; workingHoursStart: string | null; workingHoursEnd: string | null;
    workingDaysOverride: string[] | null; breaks: Break[] | null;
  } | null;
  catalog: { plans: PlanCatalog; addons: AddonCatalog; carriers: Record<string, { id: string; name: string; manualPath: string }>; forwardingNumber: string | null };
};

function firstName(name: string) {
  return name.replace(/^Dr\.?\s+/i, "").split(" ")[0] ?? name;
}

function inrPaise(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const login = useSession((s) => s.login);
  const setOnboarded = useSession((s) => s.setOnboarded);

  const [phase, setPhase] = useState<"loading" | "account" | "wizard">("loading");
  const [authing, setAuthing] = useState(false);
  const [flowType, setFlowType] = useState<"new" | "invited">("new");
  const [screenIdx, setScreenIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [existingDoctorCount, setExistingDoctorCount] = useState(0);

  // Invite-code entry (pre-auth)
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{ token: string; name: string | null; role: Role; clinicName: string | null } | null>(null);

  // Screen: practice
  const [practiceType, setPracticeType] = useState<ClinicType>("solo");
  const [clinicName, setClinicName] = useState("");
  const [founderRole, setFounderRole] = useState<Role>("doctor");

  // Screen: you
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [qualification, setQualification] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState("");
  const [personalPhone, setPersonalPhone] = useState<string | undefined>();
  const [upiId, setUpiId] = useState("");
  const [photos, setPhotos] = useState<DoctorPhoto[]>([]);
  const [qualifications, setQualifications] = useState<Record<string, string>[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, string>[]>([]);
  const [affiliations, setAffiliations] = useState<Record<string, string>[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");
  const [awards, setAwards] = useState<Record<string, string>[]>([]);
  const [memberships, setMemberships] = useState<Record<string, string>[]>([]);
  const [consultationModes, setConsultationModes] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState<Record<string, string>>({ field1: "", field2: "", field3: "", field4: "" });
  const [feeInr, setFeeInr] = useState("500");
  const [slotOverride, setSlotOverride] = useState("15");
  const [personalWorkingDays, setPersonalWorkingDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const [personalStart, setPersonalStart] = useState("09:00");
  const [personalEnd, setPersonalEnd] = useState("18:00");
  const [personalBreaks, setPersonalBreaks] = useState<Break[]>([]);

  // Screen: clinic
  const [clinicPhone, setClinicPhone] = useState<string | undefined>();
  const [addressLine1, setAddressLine1] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [defaultSlot, setDefaultSlot] = useState("15");
  const [clinicWorkingDays, setClinicWorkingDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const [clinicOpen, setClinicOpen] = useState("09:00");
  const [clinicClose, setClinicClose] = useState("18:00");
  const [tokenEnabled, setTokenEnabled] = useState(false);
  const [tokenAmount, setTokenAmount] = useState("");

  // Screen: plan
  const [catalog, setCatalog] = useState<OnboardingState["catalog"] | null>(null);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);

  // Screen: payment
  const [checkingOut, setCheckingOut] = useState(false);

  // Screen: calls
  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [dialCode, setDialCode] = useState<{ dialString: string; telUri: string } | null>(null);

  const screens = flowType === "new" ? NEW_SCREENS : INVITED_SCREENS;
  const screen = screens[screenIdx];

  // ── Resolve where a signing-in user should land ──────────────────────────
  const resolveExisting = async (): Promise<boolean> => {
    try {
      const state = await api.get<OnboardingState>("/api/v1/onboarding");
      const isOwner = state.staff.role === "owner";
      const fullyDone = state.staff.onboardingCompleted && (!isOwner || state.clinic.onboardingCompleted);

      login({
        name: state.doctor?.fullName ?? state.staff.fullName ?? "",
        email: getFirebaseAuth().currentUser?.email ?? "",
        role: state.staff.role === "receptionist" ? "receptionist" : "doctor",
        doctorId: state.doctor?.id,
        clinicName: state.clinic.name,
        clinicType: state.clinic.practiceType ?? "solo",
        clinicId: state.clinic.id,
        firebaseUid: getFirebaseAuth().currentUser?.uid ?? "",
        staffId: state.staff.id,
      });

      setOnboarded(fullyDone);
      if (fullyDone) {
        router.replace("/home");
        return true;
      }

      // Resume — hydrate what's already there and jump to the right screen.
      setFullName(state.doctor?.fullName ?? state.staff.fullName ?? "");
      setSpecialty(state.doctor?.specialty ?? "");
      setQualification(state.doctor?.qualification ?? "");
      setHeadline(state.doctor?.headline ?? "");
      setBio(state.doctor?.bio ?? "");
      setLanguages(state.doctor?.languages ?? []);
      setPersonalPhone(state.doctor?.personalPhone ?? state.staff.phone ?? undefined);
      setUpiId(state.doctor?.upiId ?? "");
      setPhotos(state.doctor?.photos ?? []);
      setQualifications(state.doctor?.qualifications ?? []);
      setRegistrations(state.doctor?.registrations ?? []);
      setAffiliations(state.doctor?.affiliations ?? []);
      setServices(state.doctor?.services ?? []);
      setAwards(state.doctor?.awards ?? []);
      setMemberships(state.doctor?.memberships ?? []);
      setConsultationModes(state.doctor?.consultationModes ?? []);
      setAdditionalInfo(state.doctor?.additionalInfo ?? { field1: "", field2: "", field3: "", field4: "" });
      if (state.doctor?.feeInr != null) setFeeInr(String(state.doctor.feeInr));
      if (state.doctor?.slotDurationOverrideMins != null) setSlotOverride(String(state.doctor.slotDurationOverrideMins));
      setPersonalWorkingDays(state.doctor?.workingDaysOverride ?? state.staff.workingDaysOverride ?? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
      setPersonalStart(state.doctor?.workingHoursStart ?? state.staff.workingHoursStart ?? "09:00");
      setPersonalEnd(state.doctor?.workingHoursEnd ?? state.staff.workingHoursEnd ?? "18:00");
      setPersonalBreaks(state.doctor?.breaks ?? state.staff.breaks ?? []);
      setClinicName(state.clinic.name);
      setPracticeType(state.clinic.practiceType ?? "solo");
      setFounderRole(state.staff.role === "receptionist" ? "receptionist" : "doctor");
      setClinicPhone(state.clinic.phone ?? undefined);
      setAddressLine1(state.clinic.addressLine1 ?? "");
      setLocality(state.clinic.locality ?? "");
      setCity(state.clinic.city ?? "");
      setPincode(state.clinic.pincode ?? "");
      if (state.clinic.defaultAppointmentDurationMins != null) setDefaultSlot(String(state.clinic.defaultAppointmentDurationMins));
      if (state.clinic.workingDays) setClinicWorkingDays(state.clinic.workingDays);
      if (state.clinic.openingHour != null) setClinicOpen(`${String(state.clinic.openingHour).padStart(2, "0")}:00`);
      if (state.clinic.closingHour != null) setClinicClose(`${String(state.clinic.closingHour).padStart(2, "0")}:00`);
      setTokenEnabled(state.clinic.tokenMoneyEnabled);
      if (state.clinic.tokenAmountPaise != null) setTokenAmount(String(Math.round(state.clinic.tokenAmountPaise / 100)));
      if (state.clinic.plan) { setPlanId(state.clinic.plan.planId); setAddonIds(state.clinic.plan.addonIds); }
      if (state.clinic.callForwarding) setCarrier(state.clinic.callForwarding.carrier);
      setCatalog(state.catalog);

      const isInvited = state.staff.role !== "owner";
      setFlowType(isInvited ? "invited" : "new");
      const targetScreens = isInvited ? INVITED_SCREENS : NEW_SCREENS;
      const stepKey = isOwner ? (state.clinic.onboardingStep ?? "clinic") : "you";
      const idx = targetScreens.findIndex((s) => s === stepKey);
      setScreenIdx(idx >= 0 ? idx : 0);
      setPhase("wizard");
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "STAFF_NOT_ONBOARDED") return false;
      toast.error("Couldn't check your account — try again.");
      return false;
    }
  };

  useEffect(() => {
    const user = getFirebaseAuth().currentUser;
    if (!user) { setPhase("account"); return; }
    void resolveExisting().then((handled) => {
      if (handled) return;
      // Already authenticated (e.g. a refresh mid-onboarding, or the E2E
      // suite's custom-token sign-in) but no staff/clinic record yet — same
      // "brand-new user" case continueWithGoogle() handles inline. Go
      // straight to the wizard instead of the account gate, which would
      // otherwise ask an already-signed-in user to sign in again.
      setFullName(user.displayName ?? "");
      setFlowType("new");
      setScreenIdx(0);
      setPhase("wizard");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The real doctor count, fetched right before the team screen needs it —
  // decides whether "Doctor" is offered as an invite role for a solo
  // practice (the backend enforces this too, but the button should reflect
  // reality rather than let the user try and get rejected).
  useEffect(() => {
    if (screen !== "team" || flowType !== "new") return;
    api
      .get<{ doctors: unknown[] }>("/api/v1/team")
      .then((team) => setExistingDoctorCount(team.doctors.length))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, flowType]);

  // ── Screen 1: account ─────────────────────────────────────────────────────
  const checkInviteCode = async () => {
    if (!inviteCodeInput.trim()) return;
    setCheckingCode(true);
    try {
      const res = await fetch(`/api/invite/by-code/${inviteCodeInput.trim().toUpperCase()}`);
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.error?.message ?? "That code doesn't look right.");
      setPendingInvite(body.data.invite);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code doesn't look right.");
    } finally {
      setCheckingCode(false);
    }
  };

  const continueWithGoogle = async () => {
    setAuthing(true);
    try {
      const user = await signInWithGoogleAdaptive();
      const idToken = await user.getIdToken();

      if (pendingInvite) {
        const res = await fetch(`/api/invite/${pendingInvite.token}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ firebaseUid: user.uid, email: user.email }),
        });
        const body = await res.json();
        if (!res.ok || !body?.success) throw new Error(body?.error?.message ?? "Couldn't accept that invite.");
        await user.getIdToken(true);
        setFullName(pendingInvite.name ?? user.displayName ?? "");
        await resolveExisting();
        setPhase("wizard");
        return;
      }

      const handled = await resolveExisting();
      if (!handled) {
        setFullName(user.displayName ?? "");
        setFlowType("new");
        setScreenIdx(0);
        setPhase("wizard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign you in — try again.");
    } finally {
      setAuthing(false);
    }
  };

  // ── Screen: practice → bootstrap ─────────────────────────────────────────
  const submitPractice = async () => {
    if (clinicName.trim().length < 2) return toast.error("Give your clinic a name");
    setSaving(true);
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("Session expired — sign in again");
      const idToken = await user.getIdToken();
      const displayName = founderRole === "doctor" ? (fullName.startsWith("Dr") ? fullName : `Dr. ${fullName || firstName(user.displayName ?? "")}`) : fullName || user.displayName || "";
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          firebaseUid: user.uid, email: user.email, fullName: displayName, clinicName, practiceType, founderRole,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.error?.message ?? "Couldn't create your clinic — try again.");
      await user.getIdToken(true);

      login({
        name: displayName,
        email: user.email ?? "",
        role: founderRole,
        doctorId: body.data.doctor?.id,
        clinicName,
        clinicType: practiceType,
        clinicId: body.data.clinic.id,
        firebaseUid: user.uid,
        staffId: body.data.staff.id,
      });
      setOnboarded(false);
      setFullName(displayName);
      const state = await api.get<OnboardingState>("/api/v1/onboarding");
      setCatalog(state.catalog);
      setScreenIdx((i) => i + 1);
      setDir(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create your clinic — try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Screen: you ───────────────────────────────────────────────────────────
  const submitProfile = async () => {
    if (!fullName.trim()) return toast.error("Enter your name");
    setSaving(true);
    try {
      await api.patch("/api/v1/onboarding/profile", {
        fullName,
        specialty: founderRole === "doctor" || flowType === "invited" ? specialty : undefined,
        qualification, headline, bio, languages, personalPhone, upiId, photos,
        qualifications, registrations, affiliations, services, awards, memberships, consultationModes, additionalInfo,
        feeInr: Number(feeInr) || undefined,
        slotDurationOverrideMins: Number(slotOverride) || undefined,
        workingDaysOverride: personalWorkingDays,
        workingHoursStart: personalStart,
        workingHoursEnd: personalEnd,
        breaks: personalBreaks,
      });
      await api.patch("/api/v1/onboarding/staff-step", { step: "hours" });

      if (flowType === "invited") {
        await api.post("/api/v1/onboarding/complete", {});
        setOnboarded(true);
        toast.success("You're all set");
        router.replace("/home");
        return;
      }
      await api.patch("/api/v1/onboarding/clinic-step", { step: "clinic" });
      setScreenIdx((i) => i + 1);
      setDir(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Screen: clinic ────────────────────────────────────────────────────────
  const submitClinic = async () => {
    setSaving(true);
    try {
      await api.patch("/api/v1/onboarding/clinic", {
        phone: clinicPhone, addressLine1, locality, city, pincode,
        defaultAppointmentDurationMins: Number(defaultSlot) || undefined,
        workingDays: clinicWorkingDays,
        openingHour: Number(clinicOpen.split(":")[0]),
        closingHour: Number(clinicClose.split(":")[0]),
        tokenMoneyEnabled: tokenEnabled,
        tokenAmountPaise: tokenEnabled && tokenAmount ? Math.round(Number(tokenAmount) * 100) : null,
      });
      await api.patch("/api/v1/onboarding/clinic-step", { step: "plan" });
      setScreenIdx((i) => i + 1);
      setDir(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Screen: plan ──────────────────────────────────────────────────────────
  const submitPlan = async () => {
    if (!planId) return toast.error("Choose a plan");
    setSaving(true);
    try {
      await api.patch("/api/v1/onboarding/plan", { planId, addonIds: planId === "custom" ? addonIds : [] });
      await api.patch("/api/v1/onboarding/clinic-step", { step: "payment" });
      setScreenIdx((i) => i + 1);
      setDir(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Screen: payment ───────────────────────────────────────────────────────
  // Redirects out to a Stripe subscription Checkout Session for the plan
  // just chosen. Stripe sends the browser back to this same page with
  // ?billing=success|cancelled — the effect below picks that up. Actual
  // subscription confirmation comes from stripe-webhook.js
  // (customer.subscription.created), not this redirect, so the "success"
  // return here just advances the wizard rather than gating on it.
  const submitPayment = async () => {
    if (!planId) return;
    setCheckingOut(true);
    try {
      const origin = window.location.origin;
      const { checkoutUrl } = await api.post<{ checkoutUrl: string }>("/api/v1/billing/subscription/checkout-session", {
        planId,
        addonIds: planId === "custom" ? addonIds : [],
        successUrl: `${origin}/onboarding?billing=success`,
        cancelUrl: `${origin}/onboarding?billing=cancelled`,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      if (err instanceof ApiError && (err.code === "STRIPE_NOT_CONFIGURED" || err.code === "STRIPE_PRICE_NOT_CONFIGURED")) {
        toast.error("Billing isn't set up for this plan yet — you can continue and subscribe later from Settings.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Couldn't start checkout — try again.");
      }
      setCheckingOut(false);
    }
  };

  const skipPayment = async () => {
    setSaving(true);
    try {
      await api.patch("/api/v1/onboarding/clinic-step", { step: "calls" });
      setScreenIdx((i) => i + 1);
      setDir(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  };

  // Picks up the ?billing=success|cancelled Stripe returned with. Runs once
  // the wizard has resumed onto the payment screen so it doesn't fire before
  // resolveExisting() has set screenIdx.
  useEffect(() => {
    if (phase !== "wizard" || screen !== "payment") return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (!billing) return;
    router.replace("/onboarding"); // strip the query param so a refresh doesn't re-trigger this
    if (billing === "success") {
      toast.success("Subscribed — welcome aboard.");
      void skipPayment(); // reuses the same "advance to calls" step-patch; nothing left to pay for here
    } else if (billing === "cancelled") {
      toast("Checkout cancelled — you can try again anytime.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, screen]);

  // ── Screen: calls ─────────────────────────────────────────────────────────
  // Reuses the reception number already collected on the "clinic" screen —
  // the same number that answers the phone is exactly the one that needs
  // forwarding set up, so this never asks twice.
  const chooseCarrier = async (c: Carrier) => {
    setCarrier(c);
    try {
      const { dialCode: code } = await api.patch<{ dialCode: { dialString: string; telUri: string } | null }>("/api/v1/onboarding/call-forwarding", {
        carrier: c, status: "instructions_viewed", receptionNumber: clinicPhone,
      });
      setDialCode(code);
    } catch {
      // non-fatal — the screen still shows manual instructions
    }
  };

  const submitCalls = async (skip: boolean) => {
    setSaving(true);
    try {
      await api.patch("/api/v1/onboarding/call-forwarding", {
        carrier: skip ? undefined : carrier,
        status: skip ? "skipped" : "user_confirmed",
        receptionNumber: clinicPhone,
      });
      await api.patch("/api/v1/onboarding/clinic-step", { step: "team" });
      setScreenIdx((i) => i + 1);
      setDir(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Screen: team → complete ──────────────────────────────────────────────
  const finish = async () => {
    setSaving(true);
    try {
      await api.post("/api/v1/onboarding/complete", {});
      setOnboarded(true);
      toast.success("Your clinic is live on ScheduRx");
      router.replace("/home");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't finish setup — try again.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => { setDir(-1); setScreenIdx((i) => Math.max(0, i - 1)); };

  const canContinue = useMemo(() => {
    if (screen === "practice") return clinicName.trim().length > 1;
    if (screen === "you") return fullName.trim().length > 1;
    return true;
  }, [screen, clinicName, fullName]);

  const onContinue = () => {
    if (screen === "practice") return void submitPractice();
    if (screen === "you") return void submitProfile();
    if (screen === "clinic") return void submitClinic();
    if (screen === "plan") return void submitPlan();
    if (screen === "payment") return void submitPayment();
    if (screen === "calls") return void submitCalls(false);
    if (screen === "team") return void finish();
  };

  if (phase === "loading") {
    return <main className="flex min-h-dvh items-center justify-center bg-bg"><Wordmark /></main>;
  }

  if (phase === "account") {
    return (
      <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center overflow-hidden px-6">
        <div className="pointer-events-none absolute -right-32 top-8 h-72 w-72 rounded-full bg-primary/[0.16] blur-[80px]" />
        <div className="relative z-10">
          <Wordmark />
          {pendingInvite ? (
            <>
              <p className="mt-8 font-display text-[clamp(2rem,8vw,2.6rem)] font-light leading-[1.05] tracking-[-0.045em]">
                You&rsquo;ve been invited to<br />{pendingInvite.clinicName ?? "a clinic"}.
              </p>
              <p className="mt-3 text-[14px] text-muted">Invited as {pendingInvite.role === "doctor" ? "doctor" : "front desk"}</p>
            </>
          ) : (
            <>
              <p className="mt-8 font-display text-[clamp(2.4rem,9vw,3.2rem)] font-light leading-[0.98] tracking-[-0.05em]">Set up your<br />clinic with ScheduRx</p>
              <p className="mt-4 max-w-[360px] text-[14px] leading-relaxed text-muted">A few details and your clinic is ready to run.</p>
            </>
          )}

          <Button size="lg" className="mt-9 w-full" onClick={() => void continueWithGoogle()} disabled={authing}>
            {authing ? "Continuing…" : "Continue with Google"}
          </Button>

          {!pendingInvite && (
            <>
              <div className="my-6 flex items-center gap-3 text-[12px] text-faint">
                <div className="h-px flex-1 bg-border/60" /> or <div className="h-px flex-1 bg-border/60" />
              </div>
              <p className="mb-2 text-[13px] text-muted">Joining an existing clinic?</p>
              <div className="flex gap-2">
                <Input placeholder="Enter invite code" value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && void checkInviteCode()} />
                <Button variant="soft" onClick={() => void checkInviteCode()} disabled={checkingCode}>{checkingCode ? "…" : "Join"}</Button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  const total = screens.length;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[520px] flex-col overflow-hidden px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] sm:px-8">
      <div className="pointer-events-none absolute -right-36 top-16 h-80 w-80 rounded-full bg-primary/[0.16] blur-[80px]" />
      {flowType === "new" && (
        <>
          <div className="relative z-10 flex items-center justify-between">
            <Wordmark />
            <span className="text-[12px] text-faint">{screenIdx + 1} / {total}</span>
          </div>
          <div className="relative z-10 mt-4 flex gap-2">
            {screens.map((s, i) => (
              <span key={s} className={cn("h-1.5 w-8 rounded-full transition-all", i <= screenIdx ? "bg-primary" : "bg-stone/25")} />
            ))}
          </div>
        </>
      )}

      <div className="relative z-10 mt-14 flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={screen} custom={dir} initial={{ opacity: 0, x: dir * 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -36 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>

            {screen === "practice" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.6rem,10vw,3.8rem)] font-light leading-[0.96] tracking-[-0.05em]">How is your<br />practice set up?</h1>
                <div className="mt-9 grid grid-cols-2 gap-2.5">
                  {([{ v: "solo" as const, icon: UserRound, t: "Solo practice", d: "One doctor, one team" }, { v: "polyclinic" as const, icon: Building2, t: "Polyclinic", d: "Multiple doctors" }]).map((o) => (
                    <button key={o.v} onClick={() => setPracticeType(o.v)} className={cn("pressable rounded-panel p-5 text-left shadow-card transition-all", practiceType === o.v ? "bg-charcoal text-white outline outline-2 outline-offset-2 outline-primary" : "bg-surface hover:bg-surface-soft")}>
                      <o.icon size={20} className={practiceType === o.v ? "text-primary" : "text-muted"} />
                      <p className="mt-5 text-[15px] font-medium">{o.t}</p>
                      <p className={cn("text-[12px]", practiceType === o.v ? "text-white/55" : "text-muted")}>{o.d}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-8 space-y-5">
                  <Field label="Clinic name"><Input autoFocus placeholder="e.g. Nirmaya Clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} /></Field>
                  <div>
                    <p className="mb-2 text-[13px] text-muted">I work here as</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["doctor", "receptionist"] as const).map((r) => (
                        <button key={r} onClick={() => setFounderRole(r)} className={cn("pressable h-12 rounded-pill text-[13px] font-medium transition-colors", founderRole === r ? "bg-charcoal text-white outline outline-2 outline-offset-2 outline-primary" : "bg-surface-2 text-muted")}>
                          {r === "doctor" ? "Doctor" : "Receptionist"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {screen === "you" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.6rem,10vw,3.8rem)] font-light leading-[0.96] tracking-[-0.05em]">{flowType === "invited" ? "Tell us about\nyou" : "About you"}</h1>
                <p className="mt-4 max-w-[390px] text-[14px] leading-relaxed text-muted">We&rsquo;ll use this for your calendar{founderRole === "doctor" || flowType === "invited" ? ", prescriptions and your clinic website" : ""}.</p>

                <div className="mt-8 space-y-5">
                  <Field label="Full name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
                  <Field label="Email" hint="From your Google account"><Input value={getFirebaseAuth().currentUser?.email ?? ""} disabled className="opacity-70" /></Field>
                  {(founderRole === "doctor" || flowType === "invited") && (
                    <Field label="Specialization"><Input placeholder="General Physician" value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></Field>
                  )}
                </div>

                {(founderRole === "doctor" || flowType === "invited") && (
                  <div className="mt-8 space-y-1 divide-y divide-border/60">
                    <ExpandableSection title="Professional profile" subtitle="Headline, bio, phone, UPI" defaultOpen={screenIdx === 0 && flowType === "invited"}>
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Years experience"><Input inputMode="numeric" placeholder="8" onChange={(e) => setAdditionalInfo((v) => ({ ...v, yearsExperience: e.target.value.replace(/\D/g, "") }))} value={additionalInfo.yearsExperience ?? ""} /></Field>
                          <Field label="Personal phone"><PhoneField value={personalPhone} onChange={setPersonalPhone} /></Field>
                        </div>
                        <Field label="Profile headline" hint={`${headline.length}/200`}><Input placeholder="Consultant Dermatologist…" maxLength={200} value={headline} onChange={(e) => setHeadline(e.target.value)} /></Field>
                        <Field label="About"><Textarea placeholder="A short bio for your clinic page" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={3000} /></Field>
                        <Field label="Preferred UPI ID" hint="Used for eligible payouts — add later if you prefer"><Input placeholder="doctor@okaxis" value={upiId} onChange={(e) => setUpiId(e.target.value)} /></Field>
                      </div>
                    </ExpandableSection>

                    <ExpandableSection title="Qualifications & registration">
                      <div className="space-y-6">
                        <RepeatableList
                          items={qualifications} onChange={setQualifications}
                          fields={[{ key: "degree", label: "Degree", placeholder: "MBBS" }, { key: "institution", label: "Institution", placeholder: "AIIMS New Delhi" }, { key: "year", label: "Year", placeholder: "2014", numeric: true }]}
                          summary={(q) => ({ title: q.degree, subtitle: [q.institution, q.year].filter(Boolean).join(" · ") })}
                          addLabel="Add qualification" emptyLabel="No qualifications added."
                        />
                        <RepeatableList
                          items={registrations} onChange={setRegistrations}
                          fields={[{ key: "number", label: "Registration number" }, { key: "council", label: "Medical council" }, { key: "year", label: "Year", numeric: true }]}
                          summary={(r) => ({ title: r.number, subtitle: [r.council, r.year].filter(Boolean).join(" · ") })}
                          addLabel="Add registration" emptyLabel="No registration added."
                        />
                      </div>
                    </ExpandableSection>

                    <ExpandableSection title="Experience & recognition">
                      <div className="space-y-6">
                        <RepeatableList
                          items={affiliations} onChange={setAffiliations}
                          fields={[{ key: "organization", label: "Hospital / organization" }, { key: "role", label: "Role" }]}
                          summary={(a) => ({ title: a.organization, subtitle: a.role })}
                          addLabel="Add affiliation" emptyLabel="No affiliations added."
                        />
                        <RepeatableList
                          items={awards} onChange={setAwards}
                          fields={[{ key: "name", label: "Award name" }, { key: "year", label: "Year", numeric: true }]}
                          summary={(a) => ({ title: a.name, subtitle: a.year })}
                          addLabel="Add award" emptyLabel="No awards added."
                        />
                        <RepeatableList
                          items={memberships} onChange={setMemberships}
                          fields={[{ key: "name", label: "Association / society" }, { key: "sinceYear", label: "Since year", numeric: true }]}
                          summary={(m) => ({ title: m.name, subtitle: m.sinceYear })}
                          addLabel="Add membership" emptyLabel="No memberships added."
                        />
                      </div>
                    </ExpandableSection>

                    <ExpandableSection title="Photos" subtitle="Up to 5, optional">
                      <PhotoGrid photos={photos} onChange={setPhotos} />
                    </ExpandableSection>

                    <ExpandableSection title="Services, languages & consultation">
                      <div className="space-y-6">
                        <div>
                          <p className="mb-2 text-[13px] text-muted">Services</p>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {services.map((s) => (
                              <span key={s} className="flex items-center gap-1 rounded-pill bg-surface-2 px-3 py-1 text-[12px] text-muted">
                                {s} <button onClick={() => setServices((v) => v.filter((x) => x !== s))} className="text-faint">×</button>
                              </span>
                            ))}
                          </div>
                          <Input placeholder="Type and press Enter" value={serviceInput} onChange={(e) => setServiceInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && serviceInput.trim()) { setServices((v) => [...v, serviceInput.trim()]); setServiceInput(""); e.preventDefault(); } }} />
                        </div>
                        <div>
                          <p className="mb-2 text-[13px] text-muted">Languages spoken</p>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {languages.map((l) => (
                              <span key={l} className="flex items-center gap-1 rounded-pill bg-surface-2 px-3 py-1 text-[12px] text-muted">
                                {l} <button onClick={() => setLanguages((v) => v.filter((x) => x !== l))} className="text-faint">×</button>
                              </span>
                            ))}
                          </div>
                          <Input placeholder="English, Hindi…" value={languageInput} onChange={(e) => setLanguageInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && languageInput.trim()) { setLanguages((v) => [...v, languageInput.trim()]); setLanguageInput(""); e.preventDefault(); } }} />
                        </div>
                        <div>
                          <p className="mb-2 text-[13px] text-muted">Consultation modes</p>
                          <div className="flex flex-wrap gap-2">
                            {["In-clinic", "Online", "Home visit"].map((m) => (
                              <button key={m} onClick={() => setConsultationModes((v) => (v.includes(m) ? v.filter((x) => x !== m) : [...v, m]))} className={cn("pressable h-10 rounded-pill px-4 text-[13px]", consultationModes.includes(m) ? "bg-charcoal text-white outline outline-2 outline-offset-2 outline-primary" : "bg-surface-2 text-muted")}>
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </ExpandableSection>

                    <ExpandableSection title="Fee & scheduling defaults">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Consultation fee (₹)"><Input inputMode="numeric" value={feeInr} onChange={(e) => setFeeInr(e.target.value.replace(/\D/g, ""))} /></Field>
                        <Field label="Slot length (min)"><Input inputMode="numeric" value={slotOverride} onChange={(e) => setSlotOverride(e.target.value.replace(/\D/g, ""))} /></Field>
                      </div>
                    </ExpandableSection>

                    <ExpandableSection title="Additional profile information">
                      <div className="space-y-3">
                        {(["field1", "field2", "field3", "field4"] as const).map((k, i) => (
                          <Textarea key={k} placeholder={`Additional information ${i + 1}`} value={additionalInfo[k] ?? ""} onChange={(e) => setAdditionalInfo((v) => ({ ...v, [k]: e.target.value }))} className="min-h-[70px]" />
                        ))}
                      </div>
                    </ExpandableSection>
                  </div>
                )}

                <ExpandableSection title="Your working hours" subtitle="When you're usually available" defaultOpen>
                  <WeeklySchedule
                    workingDays={personalWorkingDays} onWorkingDaysChange={setPersonalWorkingDays}
                    start={personalStart} end={personalEnd} onStartChange={setPersonalStart} onEndChange={setPersonalEnd}
                    breaks={personalBreaks} onBreaksChange={setPersonalBreaks}
                  />
                </ExpandableSection>
              </section>
            )}

            {screen === "clinic" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.6rem,10vw,3.8rem)] font-light leading-[0.96] tracking-[-0.05em]">Now, your<br />clinic.</h1>
                <div className="mt-8 space-y-5">
                  <Field label="Clinic / reception number"><PhoneField value={clinicPhone} onChange={setClinicPhone} /></Field>
                  <Field label="Address"><Input placeholder="Address line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Locality" value={locality} onChange={(e) => setLocality(e.target.value)} />
                    <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <Field label="PIN code"><Input inputMode="numeric" maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))} /></Field>
                  <Field label="Default appointment duration (min)"><Input inputMode="numeric" value={defaultSlot} onChange={(e) => setDefaultSlot(e.target.value.replace(/\D/g, ""))} /></Field>
                </div>

                <ExpandableSection title="Clinic hours" defaultOpen>
                  <WeeklySchedule
                    workingDays={clinicWorkingDays} onWorkingDaysChange={setClinicWorkingDays}
                    start={clinicOpen} end={clinicClose} onStartChange={setClinicOpen} onEndChange={setClinicClose}
                    breaks={[]} onBreaksChange={() => {}}
                  />
                </ExpandableSection>

                <ExpandableSection title="Advance payment">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-ink">Collect an advance to confirm appointments?</span>
                    <Switch checked={tokenEnabled} onCheckedChange={setTokenEnabled} />
                  </div>
                  {tokenEnabled && (
                    <div className="mt-4">
                      <Field label="Token amount (₹)"><Input inputMode="numeric" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value.replace(/\D/g, ""))} /></Field>
                    </div>
                  )}
                </ExpandableSection>
              </section>
            )}

            {screen === "plan" && catalog && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.4rem,9vw,3.4rem)] font-light leading-[0.98] tracking-[-0.05em]">How much should<br />ScheduRx automate?</h1>
                <div className="mt-8">
                  <PlanPicker plans={catalog.plans} addons={catalog.addons} selected={planId} onSelect={setPlanId} addonIds={addonIds} onAddonsChange={setAddonIds} />
                </div>
              </section>
            )}

            {screen === "payment" && catalog && planId && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.4rem,9vw,3.4rem)] font-light leading-[0.98] tracking-[-0.05em]">Set up<br />billing.</h1>
                <p className="mt-4 max-w-[390px] text-[14px] leading-relaxed text-muted">
                  You&rsquo;re subscribing to <span className="text-fg">{catalog.plans[planId].name}</span>
                  {planId === "custom" && addonIds.length > 0 ? ` + ${addonIds.length} add-on${addonIds.length > 1 ? "s" : ""}` : ""}
                  {" — "}
                  {inrPaise(
                    planId === "custom"
                      ? (catalog.plans.custom.basePaise ?? 0) + addonIds.reduce((sum, id) => sum + (catalog.addons[id]?.monthlyPaise ?? 0), 0)
                      : (catalog.plans[planId].monthlyPaise ?? 0),
                  )}
                  /month.
                </p>
                <p className="mt-2 max-w-[390px] text-[13px] leading-relaxed text-muted">You&rsquo;ll be taken to Stripe&rsquo;s secure checkout to add a card.</p>
                <button onClick={() => void skipPayment()} className="pressable mt-6 text-center text-[13px] text-muted underline-offset-4 hover:underline">I&rsquo;ll do this later</button>
              </section>
            )}

            {screen === "calls" && catalog && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.4rem,9vw,3.4rem)] font-light leading-[0.98] tracking-[-0.05em]">Never miss<br />a patient call.</h1>
                <p className="mt-4 max-w-[390px] text-[14px] leading-relaxed text-muted">When your clinic doesn&rsquo;t answer, ScheduRx can take over.</p>
                <div className="mt-8">
                  <CallForwardingPicker carriers={catalog.carriers} carrier={carrier} onCarrierChange={(c) => void chooseCarrier(c)} dialCode={dialCode} />
                </div>
                <button onClick={() => void submitCalls(true)} className="pressable mt-6 w-full text-center text-[13px] text-muted underline-offset-4 hover:underline">I&rsquo;ll do this later</button>
              </section>
            )}

            {screen === "team" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.4rem,9vw,3.4rem)] font-light leading-[0.98] tracking-[-0.05em]">Bring your<br />team.</h1>
                <p className="mt-4 max-w-[390px] text-[14px] leading-relaxed text-muted">Their clinic settings will already be ready when they join.</p>
                <div className="mt-8">
                  <TeamInviteScreen clinicName={clinicName} canInviteDoctor={practiceType === "polyclinic" || existingDoctorCount === 0} />
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 mt-10 flex items-center gap-3 pb-1">
        {screenIdx > 0 && flowType === "new" && (
          <button onClick={goBack} className="pressable flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Back"><ArrowLeft size={18} /></button>
        )}
        <Button size="lg" className="flex-1" disabled={!canContinue || saving || checkingOut} onClick={onContinue}>
          {checkingOut ? "Redirecting to Stripe…" : saving ? "Saving…" : screen === "team" ? "Go to ScheduRx" : screen === "payment" ? "Pay & subscribe" : "Continue"}
          {screen !== "team" && <ArrowRight size={16} />}
          {screen === "team" && <Check size={16} />}
        </Button>
      </div>
    </main>
  );
}
