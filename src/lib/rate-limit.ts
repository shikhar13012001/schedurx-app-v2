// Simple in-memory per-IP rate limiter for this app's own server-side API
// routes (onboarding, invite accept) — same shape as schedurx-backend's
// middleware/rate-limit.js. Resets on redeploy/restart and doesn't
// coordinate across instances, which is fine for a low-traffic bootstrap
// surface like this.
import "server-only";
import type { NextRequest } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// Returns true if the request should proceed, false if it's over the limit.
export function checkRateLimit(request: NextRequest, { windowMs = 60_000, max = 10 } = {}): boolean {
  const ip = clientIp(request);
  const now = Date.now();
  const entry = buckets.get(ip);

  if (!entry || now > entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
