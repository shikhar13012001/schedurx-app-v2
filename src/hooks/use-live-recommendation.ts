"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

// How much the transcript has to grow before a new recommendation is worth
// asking for — a single extra word isn't a meaningful change.
const MIN_GROWTH_CHARS = 40;
// Never re-fetch more often than this, even during continuous fast speech.
const MIN_INTERVAL_MS = 8000;
// How long the transcript has to sit still (a natural pause, or the speaker
// finishing a thought) before that "quiet" is treated as a good moment to
// ask — not on every token, not only once at the end.
const QUIET_PERIOD_MS = 2500;

export interface LiveRecommendation {
  recommendation: string | null;
  loading: boolean;
  reset: () => void;
}

// Doctor-facing only, grounded only in the transcript so far — see
// openai-service.js's suggestDuringConsult for the full safety framing.
// Debounced on a quiet period after new content, not a fixed interval, so
// it tends to land on natural pauses rather than mid-sentence.
export function useLiveRecommendation(transcript: string, active: boolean): LiveRecommendation {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedLengthRef = useRef(0);
  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    if (!active || !transcript.trim()) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const grown = transcript.length - lastFetchedLengthRef.current;
      const sinceLast = Date.now() - lastFetchAtRef.current;
      if (lastFetchedLengthRef.current > 0 && (grown < MIN_GROWTH_CHARS || sinceLast < MIN_INTERVAL_MS)) return;

      lastFetchedLengthRef.current = transcript.length;
      lastFetchAtRef.current = Date.now();
      setLoading(true);
      api
        .post<{ suggestion: string | null }>("/api/v1/visits/suggest", { transcript })
        .then(({ suggestion }) => { if (suggestion) setRecommendation(suggestion); })
        .catch(() => {
          // Best-effort — a failed suggestion call is silent, never interrupts the consult.
        })
        .finally(() => setLoading(false));
    }, QUIET_PERIOD_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [transcript, active]);

  const reset = () => {
    setRecommendation(null);
    lastFetchedLengthRef.current = 0;
    lastFetchAtRef.current = 0;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return { recommendation, loading, reset };
}
