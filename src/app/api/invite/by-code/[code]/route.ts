import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Mirrors ../[token]/route.ts — proxies to the backend's INTERNAL_API_KEY-gated
// GET /internal/staff/invites/by-code/:shortCode, for the account screen's
// "Enter invite code" box (before the invitee has a link to tap). Resolves
// to the same { token, name, role, clinicName } shape the token lookup
// returns, plus the real token so the page can proceed exactly as if the
// user had opened the link directly.
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  if (!checkRateLimit(request, { windowMs: 60_000, max: 20 })) {
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
        error: { code: "INVITE_NOT_CONFIGURED", message: "Server is missing INTERNAL_API_KEY or NEXT_PUBLIC_API_BASE_URL" },
      },
      { status: 500 },
    );
  }

  const upstream = await fetch(`${apiBaseUrl}/internal/staff/invites/by-code/${params.code}`, {
    headers: { Authorization: `Bearer ${internalApiKey}` },
  });
  const data = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}
