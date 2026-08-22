import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createTestUserCustomToken } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

// E2E test sign-in only. Mints a Firebase custom token for exactly one
// fixed test user — never a caller-supplied uid — so this can never become
// a general impersonation primitive even if TEST_AUTH_SECRET leaked; the
// blast radius is bounded to "someone can act as the one disposable test
// account", not "someone can act as any real user". TEST_AUTH_SECRET is
// unset in most environments, which fails this closed by design (see the
// 404 below — same response as a genuinely nonexistent route, so a prober
// can't tell "wrong secret" apart from "this doesn't exist").
const TEST_USER_UID = "srx-e2e-test-user";

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.TEST_AUTH_SECRET;
  if (!expected) return NextResponse.json({ success: false }, { status: 404 });

  if (!checkRateLimit(request, { windowMs: 60_000, max: 10 })) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  const provided = request.headers.get("x-test-auth-secret");
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  try {
    const token = await createTestUserCustomToken(TEST_USER_UID);
    return NextResponse.json({ success: true, data: { token, uid: TEST_USER_UID } });
  } catch (err) {
    console.error("[test-auth] failed to mint custom token", err);
    return NextResponse.json({ success: false, error: { code: "TOKEN_MINT_FAILED", message: "Couldn't create a test session." } }, { status: 500 });
  }
}
