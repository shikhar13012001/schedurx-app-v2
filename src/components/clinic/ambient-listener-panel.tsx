"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, Mic, Square, Stethoscope, X } from "lucide-react";
import { AIControl } from "@/components/ui/ai-control";
import { AudioOrbVisualizer } from "@/components/clinic/audio-orb-visualizer";
import { useAudioLevel } from "@/hooks/use-audio-level";
import type { AmbientSession } from "@/hooks/use-ambient-session";
import type { LiveRecommendation } from "@/hooks/use-live-recommendation";

function fmtElapsed(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Fixed to the bottom of the Home page, roughly a quarter of the viewport —
// the entire mic -> visual -> AI suggestions -> save flow lives here, so
// nothing ever navigates away from Home to capture a consult.
export function AmbientListenerPanel({
  session,
  recommendation,
  patientName,
  checkingOut,
  onClose,
  onSaveToNotes,
  onCheckout,
}: {
  session: AmbientSession;
  recommendation: LiveRecommendation;
  patientName?: string;
  // Both Save to Notes and Checkout end up in session.phase === "saving" —
  // this is which one the doctor actually tapped, so the *other* button
  // doesn't also read "Saving…"/"Checking out…" while it's happening.
  checkingOut: boolean;
  onClose: () => void;
  onSaveToNotes: () => void;
  onCheckout: () => void;
}) {
  const live = session.phase === "listening";
  const reviewing = session.phase === "review" || session.phase === "saving";
  const levels = useAudioLevel(live ? session.micStream : null);
  const hasSuggestions = !!(recommendation.diagnosis || recommendation.nextQuestion);

  return (
    <AnimatePresence>
      {session.phase !== "idle" && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          // Sits above BottomDock (fixed, ~70px tall, mobile-only) rather
          // than on top of it — otherwise the panel, being higher z-index,
          // completely hid Home/Calendar/Consults/Patients navigation and
          // the rest of the shell for as long as a session was open.
          className="fixed inset-x-0 bottom-[calc(70px+env(safe-area-inset-bottom)+14px)] z-40 px-3 md:bottom-4"
          data-noswipe
        >
          <div className="srx-dark-glass mx-auto flex max-h-[52vh] min-h-[26vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[30px] rounded-b-[30px] px-5 pb-4 pt-4 text-white shadow-dock">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                {session.phase === "starting" ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="text-[13px] text-white/80">Connecting…</span>
                  </>
                ) : live ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                    <span className="text-[13px] text-white/80">Listening{patientName ? ` · ${patientName}` : ""}</span>
                  </>
                ) : session.phase === "saving" ? (
                  <span className="text-[13px] text-white/80">{checkingOut ? "Checking out…" : "Saving…"}</span>
                ) : session.phase === "saved" ? (
                  <span className="text-[13px] text-primary-ink">
                    {checkingOut ? `Checked out ${patientName ?? "patient"}` : `Saved to ${patientName ?? "patient"}'s file`}
                  </span>
                ) : (
                  <span className="text-[13px] text-white/80">Recording complete</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {(live || reviewing) && <span className="tnum text-[13px] text-white/60">{fmtElapsed(session.elapsedSec)}</span>}
                {live ? (
                  <button onClick={session.stop} className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-danger text-white" aria-label="Stop recording">
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button onClick={onClose} className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70" aria-label="Close">
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {session.error && <p className="mt-2 shrink-0 text-[12px] leading-relaxed text-danger">{session.error}</p>}

            {/* Listening visual — no transcript text shown; notes are still
                captured and saved underneath exactly as before. */}
            {live && (
              <div className="flex flex-1 items-center justify-center py-2">
                <div className="h-40 w-40">
                  <AudioOrbVisualizer levels={levels} active={live} />
                </div>
              </div>
            )}

            {/* AI suggestions — diagnosis and next question are independent;
                either, both, or neither may be present at a given moment. */}
            {hasSuggestions && session.phase !== "saved" && (
              <div className="mt-3 shrink-0 space-y-2">
                {recommendation.diagnosis && (
                  <div className="flex items-start gap-2.5 rounded-[18px] bg-primary/[0.14] px-3.5 py-3">
                    <Stethoscope size={14} className="mt-0.5 shrink-0 text-primary-ink" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-white/50">AI-suggested diagnosis · for your review</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-white/85">{recommendation.diagnosis}</p>
                    </div>
                  </div>
                )}
                {recommendation.nextQuestion && (
                  <div className="flex items-start gap-2.5 rounded-[18px] bg-white/10 px-3.5 py-3">
                    <HelpCircle size={14} className="mt-0.5 shrink-0 text-white/70" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-white/50">Next question to ask</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-white/85">{recommendation.nextQuestion}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!hasSuggestions && recommendation.loading && live && (
              <p className="mt-1 shrink-0 text-center text-[11.5px] text-white/40">Thinking…</p>
            )}

            {/* Review / save actions */}
            {reviewing && (
              <div className="mt-3 shrink-0 space-y-2">
                <div className="flex items-center gap-3 text-[11.5px] text-white/50">
                  <span>Notes saved</span>
                  {session.hasRecording && <span>· Audio {session.phase === "saving" ? "saving…" : "ready"}</span>}
                </div>
                {/* Checkout does everything Save to Notes does, then also
                    marks the appointment complete and fires the patient's
                    post-visit message — the same thing tapping Next on the
                    queue does, just reachable right here instead of having
                    to close this panel and go find that button. */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={onSaveToNotes} disabled={session.phase === "saving"} className="pressable h-11 rounded-pill bg-white/10 text-[12.5px] font-medium text-white/80 disabled:opacity-50">
                    {session.phase === "saving" && !checkingOut ? "Saving…" : "Save to Notes"}
                  </button>
                  <button onClick={onCheckout} disabled={session.phase === "saving"} className="pressable h-11 rounded-pill bg-primary text-[12.5px] font-medium text-charcoal disabled:opacity-60">
                    {session.phase === "saving" && checkingOut ? "Checking out…" : "Checkout"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => void session.resume()} disabled={session.phase === "saving"} className="pressable h-10 rounded-pill bg-white/10 text-[12px] font-medium text-white/60 disabled:opacity-50">
                    Resume
                  </button>
                  <button onClick={session.discard} disabled={session.phase === "saving"} className="pressable h-10 rounded-pill bg-white/10 text-[12px] font-medium text-white/60 disabled:opacity-50">
                    Discard
                  </button>
                </div>
              </div>
            )}

            {session.phase === "saved" && (
              <div className="mt-3 flex flex-1 items-center justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/20 text-primary-ink"><Mic size={18} /></span>
              </div>
            )}

            {session.phase === "starting" && (
              <div className="mt-4 flex flex-1 items-center justify-center">
                <AIControl size={40} state="thinking" />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
