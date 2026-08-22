"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useSession } from "@/stores";
import { api, ApiError } from "@/lib/api-client";

// E2E test sign-in only — the Playwright suite's replacement for clicking
// through Google's real sign-in popup, which a headless/automated browser
// can't drive reliably. Mirrors page.tsx's real enter() flow exactly (same
// /api/v1/me + /api/v1/clinic calls, same STAFF_NOT_ONBOARDED branch) so a
// test exercises the same post-auth code path a real user does — the only
// thing swapped out is signInWithPopup for signInWithCustomToken, since the
// test's custom token (from POST /api/test-auth/token) already stands in
// for whatever Google would have handed back.
type MeResponse = {
  staff: {
    uid: string; email: string | null; fullName: string | null;
    role: "doctor" | "receptionist" | "owner"; clinicId: string; doctorId: string | null;
  };
};
type ClinicResponse = { clinic: { id: string; name: string } };

export default function TestAuthPage() {
  const router = useRouter();
  const { login } = useSession();
  const [status, setStatus] = useState("Signing in…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("Missing token.");
      return;
    }

    (async () => {
      try {
        await signInWithCustomToken(getFirebaseAuth(), token);
        const [{ staff }, { clinic }] = await Promise.all([
          api.get<MeResponse>("/api/v1/me"),
          api.get<ClinicResponse>("/api/v1/clinic"),
        ]);
        login({
          name: staff.fullName ?? staff.email ?? "E2E Test User",
          email: staff.email ?? "",
          role: staff.role === "receptionist" ? "receptionist" : "doctor",
          doctorId: staff.doctorId ?? undefined,
          clinicName: clinic.name,
          clinicType: "solo",
          clinicId: staff.clinicId,
          firebaseUid: staff.uid,
          staffId: staff.uid,
        });
        setStatus("Signed in.");
        router.replace("/home");
      } catch (err) {
        if (err instanceof ApiError && err.status === 403 && err.code === "STAFF_NOT_ONBOARDED") {
          setStatus("Signed in, not onboarded.");
          router.replace("/onboarding");
          return;
        }
        setStatus(err instanceof Error ? err.message : "Sign-in failed.");
      }
    })();
  }, [login, router]);

  return <main className="flex min-h-dvh items-center justify-center bg-bg text-[13px] text-muted">{status}</main>;
}
