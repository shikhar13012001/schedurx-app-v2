"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAmbientSession } from "@/hooks/use-ambient-session";
import { useLiveRecommendation } from "@/hooks/use-live-recommendation";
import { AmbientListenerPanel } from "@/components/clinic/ambient-listener-panel";
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
  const [target, setTarget] = useState<CaptureTarget | null>(null);

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

  return (
    <AmbientListenerPanel
      session={session}
      recommendation={recommendation}
      patientName={target?.displayName}
      onClose={session.discard}
      onSaveToNotes={() => void handleSaveToNotes()}
    />
  );
}
