// Pure decision logic behind ambient capture's lifecycle — split out of
// now-serving.tsx so the state machine, transcript accumulation, and
// suggestion throttling can be stress-tested directly, without mocking the
// microphone, MediaRecorder, or the ElevenLabs Scribe WebSocket connection
// that the component itself needs.

export type CaptureState = "idle" | "capturing" | "paused";

// What a single tap on the AIControl button should do next, given the
// current state — idle -> capturing -> paused -> capturing -> ... End is a
// separate, explicit action (the red Square button), never reached by
// tapping the AIControl itself.
export function tapCaptureAction(state: CaptureState): "start" | "pause" | "resume" {
  if (state === "idle") return "start";
  if (state === "capturing") return "pause";
  return "resume";
}

// End only does something once a session is actually open — tapping it
// while idle (e.g. a stray double-tap right after a session already ended)
// must be a safe no-op, not a second submit of the same recap.
export function canEndCapture(state: CaptureState): boolean {
  return state !== "idle";
}

// Appends a newly committed Scribe segment onto the running transcript.
// Guards against segments that are empty/whitespace-only (Scribe can emit
// these) silently corrupting the transcript with doubled/leading spaces.
export function appendTranscriptSegment(existing: string, segment: string | undefined | null): string {
  const trimmedSegment = segment?.trim();
  if (!trimmedSegment) return existing;
  return existing ? `${existing} ${trimmedSegment}` : trimmedSegment;
}

// Whether enough committed segments have accumulated since the last live
// suggestion to justify asking for a new one — not on every segment (chatty,
// mostly redundant turn-by-turn) and not only once at the end (too late to
// be useful mid-consult).
export function shouldFetchSuggestion(segmentsSinceLast: number, everyN: number): boolean {
  return segmentsSinceLast >= everyN;
}

// A transcript this short is almost certainly a false start (mic toggled
// on/off quickly, a stray word or two, background noise Scribe mis-heard as
// a word) — not a real consult worth turning into a note.
export function isMeaningfulTranscript(transcript: string, minChars: number): boolean {
  return transcript.trim().length >= minChars;
}
