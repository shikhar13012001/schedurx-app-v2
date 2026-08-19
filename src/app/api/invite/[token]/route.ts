import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Server-side only — proxies to the backend's INTERNAL_API_KEY-gated
// GET /internal/staff/invites/:token, same division as /api/onboarding:
// the key never reaches the browser. Lets the public /invite/[token] page
// show who/what the invite is for before the invitee has signed in at all.
// No identity to verify here (it's a read of public-ish invite metadata,
// not an action taken as someone) — rate-limited against token enumeration.
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
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

  const upstream = await fetch(`${apiBaseUrl}/internal/staff/invites/${params.token}`, {
    headers: { Authorization: `Bearer ${internalApiKey}` },
  });
  const data = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}
