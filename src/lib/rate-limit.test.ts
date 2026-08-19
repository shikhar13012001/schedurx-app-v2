import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimit } from "./rate-limit";

function requestFrom(ip: string): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers: { "x-forwarded-for": ip } });
}

describe("checkRateLimit", () => {
  test("allows requests under the limit and blocks once it's exceeded", () => {
    const ip = `1.2.3.${Math.floor(Math.random() * 100000)}`; // unique per test run — module-level Map persists across tests
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(requestFrom(ip), { windowMs: 60_000, max: 3 })).toBe(true);
    }
    expect(checkRateLimit(requestFrom(ip), { windowMs: 60_000, max: 3 })).toBe(false);
  });

  test("tracks separate IPs independently", () => {
    const a = `9.9.9.${Math.floor(Math.random() * 100000)}`;
    const b = `9.9.8.${Math.floor(Math.random() * 100000)}`;
    expect(checkRateLimit(requestFrom(a), { windowMs: 60_000, max: 1 })).toBe(true);
    expect(checkRateLimit(requestFrom(b), { windowMs: 60_000, max: 1 })).toBe(true);
    // second hit for `a` should now be blocked, independent of `b`
    expect(checkRateLimit(requestFrom(a), { windowMs: 60_000, max: 1 })).toBe(false);
  });
});
