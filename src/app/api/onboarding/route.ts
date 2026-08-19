import { NextRequest, NextResponse } from "next/server";
import { verifyIdTokenFromHeader, TokenVerificationError } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

// Server-side only — proxies to the backend's bootstrap-only POST /internal/clinic
// using INTERNAL_API_KEY, which must never reach the browser. This route is the
// only caller; the frontend's onboarding wizard posts here after the user signs
// in with Google, and never talks to /internal/* directly.
//
// The uid this creates a clinic/owner-staff row for is always the REAL,
// server-verified Firebase uid from the caller's own Authorization bearer
// token — never a client-supplied body field. Trusting a body.firebaseUid
// directly would let any caller provision a clinic (and its Firebase custom
// claims) under an arbitrary uid of their choosing.
export async function POST(request: NextRequest) {
  if (!checkRateLimit(request, { windowMs: 60_000, max: 10 })) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", message: "Too many requests — please wait a moment and try again." } },
      { status: 429 },
    );
  }

  const internalApiKey = process.env.INTERNAL_API_KEY;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!internalApiKey || !apiBaseUrl) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "ONBOARDING_NOT_CONFIGURED", message: "Server is missing INTERNAL_API_KEY or NEXT_PUBLIC_API_BASE_URL" },
      },
      { status: 500 },
    );
  }

  let uid: string;
  try {
    uid = await verifyIdTokenFromHeader(request.headers.get("authorization"));
  } catch (err) {
    const message = err instanceof TokenVerificationError ? err.message : "Authentication failed";
    return NextResponse.json({ success: false, error: { code: "UNAUTHENTICATED", message } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.clinicName) {
    return NextResponse.json({ success: false, error: { code: "MISSING_FIELDS", message: "clinicName is required" } }, { status: 422 });
  }

  const upstream = await fetch(`${apiBaseUrl}/internal/clinic`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${internalApiKey}` },
    body: JSON.stringify({ ...body, firebaseUid: uid }),
  });

  const data = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}
