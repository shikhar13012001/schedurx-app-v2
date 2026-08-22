import "server-only";
import { NextResponse } from "next/server";

// Every /api/onboarding, /api/invite/* route proxies to the backend the same
// way: fetch(), parse JSON, forward the status. None of them guarded the
// fetch() call itself — if it throws (backend unreachable, DNS hiccup,
// timeout), the whole route handler throws uncaught, and the client sees an
// empty/truncated response instead of JSON ("Unexpected end of JSON input"
// from res.json()), with no useful message. This wraps that whole sequence
// so a network failure always still produces a clean JSON error body.
export async function proxyToBackend(url: string, init: RequestInit): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    console.error("[backend-proxy] fetch failed", { url, err });
    return NextResponse.json(
      { success: false, error: { code: "BACKEND_UNREACHABLE", message: "Couldn't reach the server — please try again." } },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => null);
  if (data === null) {
    return NextResponse.json(
      { success: false, error: { code: "BACKEND_BAD_RESPONSE", message: "The server sent back something unexpected — please try again." } },
      { status: 502 },
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
