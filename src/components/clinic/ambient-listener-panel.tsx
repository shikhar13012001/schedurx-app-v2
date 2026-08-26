"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Mic, Square, X } from "lucide-react";
import { AIControl } from "@/components/ui/ai-control";
import type { AmbientSession } from "@/hooks/use-ambient-session";
import type { LiveRecommendation } from "@/hooks/use-live-recommendation";
import { cn } from "@/lib/utils";

function fmtElapsed(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Fixed to the bottom of the Home page, roughly a quarter of the viewport —
// the entire mic -> transcript -> recommendation -> save flow lives here,
// so nothing ever navigates away from Home to capture a consult.
export function AmbientListenerPanel({
  session,
  recommendation,
  patientName,
  onClose,
  onSaveToNotes,
}: {
  session: AmbientSession;
  recommendation: LiveRecommendation;
  patientName?: string;
  onClose: () => void;
  onSaveToNotes: () => void;
}) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const live = session.phase === "listening";
  const reviewing = session.phase === "review" || session.phase === "saving";

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session.transcript, session.partialText]);

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
          <div className="srx-dark-glass mx-auto flex max-h-[46vh] min-h-[26vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[30px] rounded-b-[30px] px-5 pb-4 pt-4 text-white shadow-dock">
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
                  <span className="text-[13px] text-white/80">Saving…</span>
                ) : session.phase === "saved" ? (
                  <span className="text-[13px] text-primary-ink">Saved to {patientName ?? "patient"}&apos;s file</span>
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

            {/* Transcript */}
            {session.phase !== "saved" && (
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto text-[14px] leading-relaxed text-white/85">
                {session.transcript || session.partialText ? (
                  <p>
                    {session.transcript}
                    {session.partialText && <span className="text-white/50"> {session.partialText}</span>}
                  </p>
                ) : (
                  <p className="text-white/45">{live ? "Say something — this updates as you speak." : "No transcript yet."}</p>
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}

            {/* Recommendation */}
            {(recommendation.recommendation || recommendation.loading) && session.phase !== "saved" && (
              <div className="mt-3 flex shrink-0 items-start gap-2.5 rounded-[18px] bg-primary/[0.14] px-3.5 py-3">
                <Lightbulb size={14} className="mt-0.5 shrink-0 text-primary-ink" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/50">Consider</p>
                  <p className={cn("mt-0.5 text-[13px] leading-relaxed text-white/85", recommendation.loading && !recommendation.recommendation && "text-white/40")}>
                    {recommendation.recommendation ?? "Thinking…"}
                  </p>
                </div>
                {recommendation.loading && recommendation.recommendation && <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
              </div>
            )}

            {/* Review / save actions */}
            {reviewing && (
              <div className="mt-3 shrink-0 space-y-2.5">
                <div className="flex items-center gap-3 text-[11.5px] text-white/50">
                  <span>Transcript saved</span>
                  {session.hasRecording && <span>· Audio {session.phase === "saving" ? "saving…" : "ready"}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={session.discard} disabled={session.phase === "saving"} className="pressable h-11 rounded-pill bg-white/10 text-[12.5px] font-medium text-white/80 disabled:opacity-50">
                    Discard
                  </button>
                  <button onClick={() => void session.resume()} disabled={session.phase === "saving"} className="pressable h-11 rounded-pill bg-white/10 text-[12.5px] font-medium text-white/80 disabled:opacity-50">
                    Resume
                  </button>
                  <button onClick={onSaveToNotes} disabled={session.phase === "saving"} className="pressable h-11 rounded-pill bg-primary text-[12.5px] font-medium text-charcoal disabled:opacity-60">
                    {session.phase === "saving" ? "Saving…" : "Save to Notes"}
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
