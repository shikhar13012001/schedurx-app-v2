"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { toast } from "sonner";
import { Wordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase";

type InviteDetails = { name: string | null; role: "doctor" | "receptionist"; clinicName: string | null };

// Public — no session required to land here. Uses plain relative fetch()
// against this app's own /api/invite/[token] routes (server-side proxies to
// the backend's INTERNAL_API_KEY-gated endpoints), not the api-client.ts
// helper — that helper targets the *backend's* origin, and these are Next.js
// routes on this app's own origin.
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((res) => res.json())
      .then((body) => setInvite(body?.success ? body.data.invite : null))
      .catch(() => setInvite(null));
  }, [token]);

  const join = async () => {
    setJoining(true);
    try {
      const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
      const user = result.user;

      // The route verifies this ID token server-side and uses ITS uid for
      // the actual accept call — the body's firebaseUid is unused for
      // authorization, never trusted on its own.
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ firebaseUid: user.uid, email: user.email }),
      });
      const body = await response.json();
      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.message ?? "Couldn't accept that invite.");
      }

      // Custom claims apply on next token refresh — force one now.
      await user.getIdToken(true);

      // acceptInvite starts this person's own short onboarding (their own
      // profile + working hours — the clinic itself is already fully set
      // up by whoever invited them). /onboarding resolves the now-signed-in
      // Firebase user, sees onboarding incomplete, and lands them straight
      // into that shortened flow instead of Screen 1's Google button.
      toast.success(`Welcome to ${invite?.clinicName ?? "the team"}`);
      router.replace("/onboarding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join — try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <Wordmark size="lg" />
      {invite === undefined && <p className="mt-8 text-[13px] text-muted">Checking your invite…</p>}
      {invite === null && (
        <div className="mt-8 max-w-sm">
          <p className="font-display text-[28px] font-light tracking-[-0.045em]">This invite isn&rsquo;t valid.</p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">It may have already been used or expired. Ask whoever invited you to send a new one.</p>
        </div>
      )}
      {invite && (
        <div className="mt-8 max-w-sm">
          <p className="font-display text-[30px] font-light leading-tight tracking-[-0.05em]">
            Join {invite.clinicName ?? "your clinic"}<br />as a {invite.role === "doctor" ? "doctor" : "front desk"}.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">Sign in with the Google account you&rsquo;ll use every day.</p>
          <Button size="lg" className="mt-7 w-full" onClick={join} disabled={joining}>{joining ? "Joining…" : "Continue with Google"}</Button>
        </div>
      )}
    </main>
  );
}
