import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { toDateKey, dateAt, relTime, dueLabel, inr, initials, hueFor, fmtDate } from "./utils";

describe("toDateKey", () => {
  test("formats a local date as YYYY-MM-DD, zero-padded", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("dateAt", () => {
  test("builds a local date from a YYYY-MM-DD key + hour/minute, round-trippable via toDateKey", () => {
    const iso = dateAt("2026-03-15", 14, 30);
    const d = new Date(iso);
    expect(toDateKey(d)).toBe("2026-03-15");
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  test("defaults minutes to 0", () => {
    const d = new Date(dateAt("2026-01-01", 9));
    expect(d.getMinutes()).toBe(0);
  });
});

describe("relTime / dueLabel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("relTime reports 'now' for the current instant and buckets minutes/hours/days for the past", () => {
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    expect(relTime(new Date("2026-01-10T12:00:00Z").toISOString())).toBe("now");
    expect(relTime(new Date("2026-01-10T11:45:00Z").toISOString())).toBe("15m ago");
    expect(relTime(new Date("2026-01-10T09:00:00Z").toISOString())).toBe("3h ago");
    expect(relTime(new Date("2026-01-08T12:00:00Z").toISOString())).toBe("2d ago");
  });

  test("dueLabel reports 'now' for a past/present due time and buckets the future", () => {
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    expect(dueLabel(new Date("2026-01-10T11:00:00Z").toISOString())).toBe("now");
    expect(dueLabel(new Date("2026-01-10T12:30:00Z").toISOString())).toBe("in 30m");
    expect(dueLabel(new Date("2026-01-10T15:00:00Z").toISOString())).toBe("in 3h");
    expect(dueLabel(new Date("2026-01-12T12:00:00Z").toISOString())).toBe("in 2d");
    // 7+ days out falls back to a plain formatted date, not a "in Nd" label.
    const farOut = new Date("2026-02-01T12:00:00Z").toISOString();
    expect(dueLabel(farOut)).toBe(fmtDate(farOut));
  });
});

describe("inr", () => {
  test("formats a number with the rupee sign and Indian digit grouping", () => {
    expect(inr(500)).toBe("₹500");
    expect(inr(100000)).toBe("₹1,00,000");
  });
});

describe("initials", () => {
  test("strips a leading 'Dr.' and takes the first letter of up to 2 words", () => {
    expect(initials("Dr. Meera Krishnan")).toBe("MK");
    expect(initials("Dr Sameer Rao")).toBe("SR");
    expect(initials("Arjun")).toBe("A");
  });
});

describe("hueFor", () => {
  test("is deterministic for the same id", () => {
    expect(hueFor("patient-123")).toBe(hueFor("patient-123"));
  });

  test("returns a value from the fixed hue palette", () => {
    const AVATAR_HUES = [156, 200, 32, 262, 8, 176, 98, 322];
    expect(AVATAR_HUES).toContain(hueFor("some-id"));
  });
});
