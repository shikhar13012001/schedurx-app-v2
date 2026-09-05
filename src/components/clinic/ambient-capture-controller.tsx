"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAmbientSession } from "@/hooks/use-ambient-session";
import { useLiveRecommendation } from "@/hooks/use-live-recommendation";
import { AmbientListenerPanel } from "@/components/clinic/ambient-listener-panel";
import { useClinic } from "@/stores";
import { ApiError } from "@/lib/api-client";
import type { CaptureTarget } from "@/lib/capture-session";

// Owns the session + recommendation hooks and renders the bottom listener
// panel — mounted once on the Home page (dynamically imported so the
// ElevenLabs SDK it pulls in doesn't ship on every page's bundle). Listens
// for the "srx-start-capture" window event NowServing's mic button
// dispatches, rather than receiving the target patient via props, since
// this isn't its sibling in the render tree.
export function AmbientCaptureController() {
  const router = useRouter();
  const session = useAmbientSession();
  const recommendation = useLiveRecommendation(session.transcript, session.phase === "listening");
  const { completeCurrent } = useClinic();
  const [target, setTarget] = useState<CaptureTarget | null>(null);
  // Save to Notes and Checkout both drive session.phase through "saving" —
  // this is which one is actually in flight, so the panel doesn't show
  // "Checking out…" on the button nobody tapped.
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    const onStart = (event: Event) => {
      const detail = (event as CustomEvent<CaptureTarget>).detail;
      if (!detail?.patientId) {
        toast.error("No patient file to record to — this looks like a walk-in with no record yet.");
        return;
      }
      setTarget(detail);
      void session.start();
    };
    window.addEventListener("srx-start-capture", onStart);
    return () => window.removeEventListener("srx-start-capture", onStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.start]);

  useEffect(() => {
    if (session.phase === "idle") recommendation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

  const handleSaveToNotes = async () => {
    if (!target?.patientId) return;
    const saved = await session.saveToNotes({
      patientId: target.patientId,
      doctorId: target.doctorId,
      appointmentId: target.appointmentId,
      symptoms: target.symptoms,
      recommendation: recommendation.recommendation,
    });
    if (saved) toast.success(`Saved to ${target.displayName?.split(" ")[0] ?? "patient"}'s file`);
  };

  // Everything Save to Notes does, then also marks the appointment complete
  // and fires the patient's post-visit message — the same markCompleted/comms
  // path as queue "Next", just reachable here so a doctor can finish the
  // whole visit without leaving this panel. Deliberately does NOT advance
  // the queue to the next patient (that used to be a live-reported bug:
  // Checkout silently moved the doctor off the current patient's screen
  // before they meant to move on) — completeCurrent leaves the queue
  // exactly where it is; the doctor taps ">" separately when ready.
  const handleCheckout = async () => {
    if (!target?.patientId) return;
    setCheckingOut(true);
    try {
      const saved = await session.saveToNotes({
        patientId: target.patientId,
        doctorId: target.doctorId,
        appointmentId: target.appointmentId,
        symptoms: target.symptoms,
        recommendation: recommendation.recommendation,
      });
      if (!saved) return;
      try {
        await completeCurrent(target.doctorId);
        toast.success(`${target.displayName?.split(" ")[0] ?? "Patient"} checked out`, {
          description: "Visit marked complete — their post-visit message is on its way. Tap › when you're ready for the next patient.",
        });
        // Video/audio consults have no in-person moment where a doctor would
        // naturally think to open the patient file and write a prescription
        // — surface it as a one-tap suggestion right after checkout instead
        // of forcing navigation (a doctor moving straight to the next
        // patient shouldn't be interrupted by a redirect they didn't ask for).
        if (target.mode === "video" || target.mode === "audio") {
          toast.message("Add a prescription?", {
            description: `${target.displayName?.split(" ")[0] ?? "This patient"} won't get one automatically for a remote visit.`,
            action: { label: "Open file", onClick: () => router.push(`/patients/${target.patientId}?rx=1`) },
          });
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Saved the note, but couldn't complete checkout — try marking it done from the queue.");
      }
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <AmbientListenerPanel
      session={session}
      recommendation={recommendation}
      patientName={target?.displayName}
      checkingOut={checkingOut}
      onClose={session.discard}
      onSaveToNotes={() => void handleSaveToNotes()}
      onCheckout={() => void handleCheckout()}
    />
  );
}
