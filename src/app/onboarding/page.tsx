"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { signInWithPopup } from "firebase/auth";
import { ArrowLeft, ArrowRight, Building2, Check, Mail, Plus, Stethoscope, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useSession } from "@/stores";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import type { ClinicType, Role } from "@/lib/types";

type OnboardingResponse = {
  clinic: { id: string; name: string };
  doctor: { id: string };
  staff: { uid: string; role: "doctor" | "receptionist" | "owner"; clinicId: string; doctorId: string | null; fullName: string | null; email: string | null };
};

type Invite = { email: string; role: Role };

export default function OnboardingPage() {
  const router = useRouter();
  const login = useSession((s) => s.login);

  const [dir, setDir] = useState(1);
  const [step, setStep] = useState(0);
  const [clinicName, setClinicName] = useState("");
  const [clinicType, setClinicType] = useState<ClinicType>("solo");
  const [docName, setDocName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [fee, setFee] = useState("500");
  const [slot, setSlot] = useState("15");
  const [regNo, setRegNo] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("receptionist");
  const [hours, setHours] = useState({ mStart: "09:00", mEnd: "13:00", eStart: "17:00", eEnd: "21:00" });
  const [finishing, setFinishing] = useState(false);

  const steps = useMemo(
    () => (clinicType === "polyclinic" ? ["clinic", "you", "team", "hours"] : ["clinic", "you", "hours"]),
    [clinicType]
  );
  const key = steps[step];

  const canNext =
    key === "clinic" ? clinicName.trim().length > 1
    : key === "you" ? docName.trim().length > 1 && specialty.trim().length > 1
    : true;

  const go = (d: number) => { setDir(d); setStep((s) => Math.min(steps.length - 1, Math.max(0, s + d))); };

  const finish = async () => {
    setFinishing(true);
    try {
      const auth = getFirebaseAuth();
      let user = auth.currentUser;
      if (!user) {
        const result = await signInWithPopup(auth, googleProvider);
        user = result.user;
      }

      const name = docName.startsWith("Dr") ? docName : `Dr. ${docName}`;
      // Plain relative fetch against this app's OWN /api/onboarding route (a
      // server-side proxy to the backend's INTERNAL_API_KEY-gated
      // /internal/clinic) — not api-client.ts's api.post(), which prepends
      // NEXT_PUBLIC_API_BASE_URL and would send this straight to the
      // backend's origin, where no such route exists. Mirrors the working
      // pattern already used by src/app/invite/[token]/page.tsx.
      //
      // The route verifies this ID token server-side and uses ITS uid for
      // the actual clinic-creation call — the body's firebaseUid below is
      // unused for authorization (kept only for readability/back-compat),
      // never trusted on its own.
      const idToken = await user.getIdToken();
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          firebaseUid: user.uid,
          email: user.email,
          fullName: name,
          clinicName,
          workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          openingHour: Number(hours.mStart.split(":")[0]),
          closingHour: Number(hours.eEnd.split(":")[0]),
          doctor: { fullName: name, specialty, feeInr: Number(fee), languages: [] },
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.message ?? "Couldn't finish setting up your clinic — try again.");
      }
      const onboarded = body.data as OnboardingResponse;

      // Custom claims apply on next token refresh — force one before /api/v1/me.
      await user.getIdToken(true);

      login({
        name,
        email: onboarded.staff.email ?? user.email ?? "",
        role: onboarded.staff.role === "receptionist" ? "receptionist" : "doctor",
        doctorId: onboarded.staff.doctorId ?? undefined,
        clinicName: onboarded.clinic.name,
        clinicType,
        clinicId: onboarded.staff.clinicId,
        firebaseUid: onboarded.staff.uid,
        staffId: onboarded.staff.uid,
      });

      if (invites.length) toast.success(`${invites.length} invite${invites.length > 1 ? "s" : ""} noted — invite them from Team once they've signed in once`);
      toast.success("Your clinic is live on ScheduRx");
      router.replace("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't finish setting up your clinic — try again.");
    } finally {
      setFinishing(false);
    }
  };

  const addInvite = () => {
    if (!/^\S+@\S+\.\S+$/.test(inviteEmail)) return toast.error("Enter a valid email");
    setInvites((v) => [...v, { email: inviteEmail, role: inviteRole }]);
    setInviteEmail("");
  };

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[520px] flex-col overflow-hidden px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] sm:px-8">
      <div className="pointer-events-none absolute -right-36 top-16 h-80 w-80 rounded-full bg-primary/[0.16] blur-[80px]" />
      <div className="relative z-10 flex items-center justify-between">
        <Wordmark />
        <span className="text-[12px] text-faint">{step + 1} / {steps.length}</span>
      </div>
      <div className="relative z-10 mt-4 flex gap-2">
        {steps.map((s, i) => (
          <span key={s} className={cn("h-1.5 w-8 rounded-full transition-all", i <= step ? "bg-primary" : "bg-stone/25")} />
        ))}
      </div>

      <div className="relative z-10 mt-14 flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={key}
            custom={dir}
            initial={{ opacity: 0, x: dir * 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -36 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {key === "clinic" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.8rem,11vw,4.1rem)] font-light leading-[0.94] tracking-[-0.055em]">Name your clinic</h1>
                <p className="mt-5 max-w-[390px] text-[14px] leading-relaxed text-muted">This appears on reminders, prescriptions and your patient-facing links.</p>
                <div className="mt-10 space-y-7">
                  <Field label="Clinic name">
                    <Input autoFocus placeholder="e.g. Nirmaya Clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                  </Field>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-muted">How does your clinic run?</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {([
                        { v: "solo", icon: UserRound, t: "Just me", d: "Single practitioner" },
                        { v: "polyclinic", icon: Building2, t: "A team", d: "Multiple doctors & staff" },
                      ] as const).map((o) => (
                        <button key={o.v} onClick={() => setClinicType(o.v)}
                          className={cn("pressable rounded-panel p-5 text-left transition-all shadow-card",
                            clinicType === o.v ? "bg-charcoal text-white" : "bg-surface hover:bg-surface-soft")}>
                          <o.icon size={20} className={clinicType === o.v ? "text-primary" : "text-muted"} />
                          <p className="mt-5 text-[15px] font-medium">{o.t}</p>
                          <p className={cn("text-[12px]", clinicType === o.v ? "text-white/[0.55]" : "text-muted")}>{o.d}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {key === "you" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.8rem,11vw,4.1rem)] font-light leading-[0.94] tracking-[-0.055em]">About you</h1>
                <p className="mt-5 max-w-[390px] text-[14px] leading-relaxed text-muted">Used for your calendar, prescriptions and your clinic website later.</p>
                <div className="mt-10 space-y-5">
                  <Field label="Your name"><Input placeholder="Dr. Meera Krishnan" value={docName} onChange={(e) => setDocName(e.target.value)} /></Field>
                  <Field label="Specialization"><Input placeholder="General Physician" value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Consultation fee (₹)"><Input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} /></Field>
                    <Field label="Slot length (min)"><Input inputMode="numeric" value={slot} onChange={(e) => setSlot(e.target.value.replace(/\D/g, ""))} /></Field>
                  </div>
                  <Field label="Medical registration no." hint="Shown on digital prescriptions — optional for now">
                    <Input placeholder="KMC/41288" value={regNo} onChange={(e) => setRegNo(e.target.value)} />
                  </Field>
                </div>
              </section>
            )}

            {key === "team" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.8rem,11vw,4.1rem)] font-light leading-[0.94] tracking-[-0.055em]">Invite your team</h1>
                <p className="mt-5 max-w-[390px] text-[14px] leading-relaxed text-muted">Doctors get their own calendar, managed independently. Receptionists see everyone&rsquo;s.</p>
                <div className="mt-10 flex gap-2">
                  <Input placeholder="teammate@clinic.in" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addInvite()} />
                  <Button variant="soft" size="icon" className="h-11 w-11 shrink-0" onClick={addInvite} aria-label="Add invite"><Plus size={18} /></Button>
                </div>
                <div className="mt-2.5">
                  <Segmented<Role> options={[{ value: "receptionist", label: "Receptionist" }, { value: "doctor", label: "Doctor" }]} value={inviteRole} onChange={setInviteRole} />
                </div>
                <div className="mt-4 space-y-2">
                  {invites.length === 0 && <p className="rounded-panel bg-surface-soft px-4 py-7 text-center text-[13px] text-faint">No invites yet — you can also add people later from Team.</p>}
                  {invites.map((iv, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-field bg-surface px-3 py-3 shadow-card">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-muted">
                        {iv.role === "doctor" ? <Stethoscope size={14} /> : <Mail size={14} />}
                      </span>
                      <span className="flex-1 truncate text-[14px]">{iv.email}</span>
                      <span className="text-[11px] font-medium text-faint">{iv.role}</span>
                      <button onClick={() => setInvites((v) => v.filter((_, j) => j !== i))} className="p-1 text-faint hover:text-danger" aria-label={`Remove ${iv.email}`}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {key === "hours" && (
              <section>
                <h1 className="text-balance font-display text-[clamp(2.8rem,11vw,4.1rem)] font-light leading-[0.94] tracking-[-0.055em]">Your usual hours</h1>
                <p className="mt-5 max-w-[390px] text-[14px] leading-relaxed text-muted">The AI receptionist only books inside these. Block time anytime from Home.</p>
                <div className="mt-10 space-y-5">
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-muted">Morning</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="time" value={hours.mStart} onChange={(e) => setHours({ ...hours, mStart: e.target.value })} />
                      <Input type="time" value={hours.mEnd} onChange={(e) => setHours({ ...hours, mEnd: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-muted">Evening</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="time" value={hours.eStart} onChange={(e) => setHours({ ...hours, eStart: e.target.value })} />
                      <Input type="time" value={hours.eEnd} onChange={(e) => setHours({ ...hours, eEnd: e.target.value })} />
                    </div>
                  </div>
                  <div className="rounded-panel bg-surface p-5 shadow-card">
                    <p className="flex items-center gap-2 text-[14px] font-medium text-ink"><Check size={16} /> {clinicName || "Your clinic"} is ready</p>
                    <p className="mt-1 text-[13px] text-muted">Calendar, queue and patient directory are set up. Bookings can start flowing in.</p>
                  </div>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 mt-10 flex items-center gap-3 pb-1">
        {step > 0 && (
          <button onClick={() => go(-1)} className="pressable flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Back"><ArrowLeft size={18} /></button>
        )}
        {step < steps.length - 1 ? (
          <Button size="lg" className="flex-1" disabled={!canNext} onClick={() => go(1)}>Continue <ArrowRight size={16} /></Button>
        ) : (
          <Button size="lg" className="flex-1" disabled={finishing} onClick={() => void finish()}>{finishing ? "Setting up…" : "Enter ScheduRx"} <ArrowRight size={16} /></Button>
        )}
      </div>
    </main>
  );
}
