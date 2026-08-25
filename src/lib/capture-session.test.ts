import { describe, test, expect } from "vitest";
import {
  appendTranscriptSegment,
  canEndCapture,
  isMeaningfulTranscript,
  shouldFetchSuggestion,
  tapCaptureAction,
  type CaptureState,
} from "./capture-session";

describe("tapCaptureAction", () => {
  test("cycles idle -> start -> pause -> resume -> pause -> ...", () => {
    let state: CaptureState = "idle";
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const action = tapCaptureAction(state);
      seen.push(action);
      state = action === "start" ? "capturing" : action === "pause" ? "paused" : "capturing";
    }
    expect(seen).toEqual(["start", "pause", "resume", "pause", "resume", "pause"]);
  });

  test("every state maps to exactly one of the three actions", () => {
    (["idle", "capturing", "paused"] as const).forEach((state) => {
      expect(["start", "pause", "resume"]).toContain(tapCaptureAction(state));
    });
  });
});

describe("canEndCapture", () => {
  test("false only when idle — a stray tap on End right after a session already closed is a no-op", () => {
    expect(canEndCapture("idle")).toBe(false);
    expect(canEndCapture("capturing")).toBe(true);
    expect(canEndCapture("paused")).toBe(true);
  });
});

describe("appendTranscriptSegment", () => {
  test("joins segments with a single space", () => {
    expect(appendTranscriptSegment("fever since yesterday", "gave paracetamol")).toBe(
      "fever since yesterday gave paracetamol"
    );
  });

  test("starting from empty, the first segment has no leading space", () => {
    expect(appendTranscriptSegment("", "hello doctor")).toBe("hello doctor");
  });

  test("ignores an empty, whitespace-only, or missing segment — Scribe can emit these mid-session", () => {
    expect(appendTranscriptSegment("existing text", "")).toBe("existing text");
    expect(appendTranscriptSegment("existing text", "   ")).toBe("existing text");
    expect(appendTranscriptSegment("existing text", undefined)).toBe("existing text");
    expect(appendTranscriptSegment("existing text", null)).toBe("existing text");
  });

  test("trims each incoming segment before appending, so double spaces never accumulate", () => {
    expect(appendTranscriptSegment("a", "  b  ")).toBe("a b");
  });

  test("stress: 500 rapid-fire segments (a full long consult) never produces doubled/leading whitespace", () => {
    let transcript = "";
    for (let i = 0; i < 500; i++) {
      transcript = appendTranscriptSegment(transcript, i % 7 === 0 ? "" : `segment${i}`);
    }
    expect(transcript.startsWith(" ")).toBe(false);
    expect(transcript.includes("  ")).toBe(false);
    // 500 segments, 1 in 7 dropped as empty (i % 7 === 0, i.e. i=0,7,...,497 -> 72 dropped)
    expect(transcript.split(" ")).toHaveLength(500 - 72);
  });

  test("handles multi-language text (Hindi/Tamil code-switching) without corrupting it", () => {
    const t1 = appendTranscriptSegment("", "बुखार कल से है");
    const t2 = appendTranscriptSegment(t1, "fever since yesterday");
    const t3 = appendTranscriptSegment(t2, "காய்ச்சல் இரண்டு நாட்களாக");
    expect(t3).toBe("बुखार कल से है fever since yesterday காய்ச்சல் இரண்டு நாட்களாக");
  });
});

describe("shouldFetchSuggestion", () => {
  test("fires only once the threshold is reached, not before", () => {
    expect(shouldFetchSuggestion(0, 3)).toBe(false);
    expect(shouldFetchSuggestion(2, 3)).toBe(false);
    expect(shouldFetchSuggestion(3, 3)).toBe(true);
  });

  test("still fires if the counter somehow overshoots the threshold", () => {
    expect(shouldFetchSuggestion(9, 3)).toBe(true);
  });

  test("everyN=0 or negative never blocks (guards against a misconfigured constant hanging suggestions forever)", () => {
    expect(shouldFetchSuggestion(0, 0)).toBe(true);
    expect(shouldFetchSuggestion(1, -1)).toBe(true);
  });
});

describe("isMeaningfulTranscript", () => {
  test("rejects a stray word or two from a false-start mic toggle", () => {
    expect(isMeaningfulTranscript("test", 12)).toBe(false);
    expect(isMeaningfulTranscript("ok yeah", 12)).toBe(false);
  });

  test("accepts a real short recap", () => {
    expect(isMeaningfulTranscript("fever since yesterday, gave paracetamol", 12)).toBe(true);
  });

  test("trims before measuring — surrounding whitespace from Scribe doesn't inflate the count", () => {
    expect(isMeaningfulTranscript("   hi   ", 12)).toBe(false);
  });

  test("boundary: exactly at the threshold counts as meaningful", () => {
    expect(isMeaningfulTranscript("x".repeat(12), 12)).toBe(true);
    expect(isMeaningfulTranscript("x".repeat(11), 12)).toBe(false);
  });

  test("an all-whitespace transcript of any length is never meaningful", () => {
    expect(isMeaningfulTranscript(" ".repeat(50), 12)).toBe(false);
  });
});
