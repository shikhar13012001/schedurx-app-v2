"use client";

import { useEffect, useState } from "react";
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
  const session = useAmbientSession();
  const recommendation = useLiveRecommendation(session.transcript, session.phase === "listening");
  const { next } = useClinic();
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
  // and fires the patient's post-visit message — the same
  // markCompleted/comms path queue "Next" already triggers, just reachable
  // here so a doctor can finish the whole visit without leaving this panel
  // to go find that button. Gracefully handles nobody else being queued
  // next (queueSvc.advance already treats that as a normal, not an error).
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
        await next(target.doctorId);
        toast.success(`${target.displayName?.split(" ")[0] ?? "Patient"} checked out`, {
          description: "Visit marked complete — their post-visit message is on its way.",
        });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Saved the note, but couldn't complete checkout — try Next from the queue.");
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
