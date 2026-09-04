"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Wordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { useSession } from "@/stores";
import { signInWithGoogleAdaptive } from "@/lib/native-google-signin";
import { api, ApiError } from "@/lib/api-client";

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

type MeResponse = {
  staff: {
    uid: string; email: string | null; fullName: string | null;
    role: "doctor" | "receptionist" | "owner"; clinicId: string; doctorId: string | null;
  };
};
type ClinicResponse = { clinic: { id: string; name: string } };

export default function LoginPage() {
  const router = useRouter();
  const { session, hydrated, login } = useSession();
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (hydrated && session) router.replace("/home"); }, [hydrated, session, router]);

  const enter = async () => {
    setBusy(true);
    try {
      await signInWithGoogleAdaptive();
      const [{ staff }, { clinic }] = await Promise.all([
        api.get<MeResponse>("/api/v1/me"),
        api.get<ClinicResponse>("/api/v1/clinic"),
      ]);

      login({
        name: staff.fullName ?? staff.email ?? "Team member",
        email: staff.email ?? "",
        role: staff.role === "receptionist" ? "receptionist" : "doctor",
        doctorId: staff.doctorId ?? undefined,
        clinicName: clinic.name,
        clinicType: "solo",
        clinicId: staff.clinicId,
        firebaseUid: staff.uid,
        staffId: staff.uid,
      });
      router.replace("/home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code === "STAFF_NOT_ONBOARDED") {
        router.push("/onboarding");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-bg px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] sm:px-6 md:grid md:grid-cols-[1.05fr_.95fr] md:gap-6 md:p-6">
      <section className="atmosphere atmosphere-orange-right relative flex min-h-[43dvh] overflow-hidden rounded-hero bg-stone p-6 text-charcoal shadow-float dark:text-white md:min-h-[calc(100dvh-48px)] md:items-end md:p-10 lg:p-14">
        <div className="relative z-10 w-full">
          <div className="srx-glass-hero inline-flex rounded-pill px-4 py-2"><Wordmark size="lg" /></div>
          <p className="mt-12 max-w-[540px] text-balance font-display text-[clamp(3.2rem,12vw,7rem)] font-light leading-[0.88] tracking-[-0.065em]">The clinic,<br />in rhythm.</p>
          <p className="mt-6 max-w-[380px] text-[14px] leading-relaxed text-charcoal/[0.72] dark:text-white/[0.72]">Appointments, queue, patients, consults and the work between them—held in one calm place.</p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center px-2 pb-4 pt-8 md:px-7 md:py-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key="who" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <p className="text-[12px] text-muted">ScheduRx workspace</p>
            <h1 className="mt-2 font-display text-[42px] font-light leading-[0.96] tracking-[-0.055em]">Take your place.</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">Sign in with the Google account your clinic uses.</p>

            <div className="mt-8 space-y-3">
              <Button size="lg" className="w-full" onClick={enter} disabled={busy}>
                <GoogleG /> {busy ? "Signing in…" : "Continue with Google"}
              </Button>
            </div>
            <button onClick={() => router.push("/onboarding")} className="mt-7 w-full text-center text-[12px] text-muted hover:text-ink">Setting up a new clinic? <span className="text-primary-ink">Start here →</span></button>
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}
