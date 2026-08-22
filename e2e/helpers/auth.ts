import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { deleteTestClinic } from "./test-clinic";

const API_BASE = process.env.E2E_API_BASE_URL ?? "https://api.schedurx.com";
// /api/test-auth/token is a Next.js route baked into the dashboard itself
// (src/app/api/test-auth/token/route.ts), not the Express backend — it has
// to be requested against the dashboard's own origin, same as playwright
// config's `use.baseURL`, or it 404s on api.schedurx.com instead.
const APP_BASE = process.env.E2E_BASE_URL ?? "https://app.schedurx.com";
export const TEST_UID = "srx-e2e-test-user";

function testAuthSecret(): string {
  const secret = process.env.TEST_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "TEST_AUTH_SECRET is not set — copy e2e/.env.test.local.example to e2e/.env.test.local and fill it in " +
        "with the same value configured as TEST_AUTH_SECRET in Vercel.",
    );
  }
  return secret;
}

// If a previous run crashed before its own afterAll cleanup ran, the fixed
// test uid could still be attached to a leftover clinic — and
// Staff.firebaseUid being 1:1 means that's not just clutter, it'll break
// this run outright. Self-healing: look it up and purge it before doing
// anything else.
export async function purgeAnyStaleTestClinic(request: APIRequestContext): Promise<void> {
  const internalApiKey = process.env.E2E_INTERNAL_API_KEY;
  if (!internalApiKey) throw new Error("E2E_INTERNAL_API_KEY is not set in e2e/.env.test.local");

  const response = await request.get(`${API_BASE}/internal/clinic/by-firebase-uid/${TEST_UID}`, {
    headers: { Authorization: `Bearer ${internalApiKey}` },
  });
  if (!response.ok()) return;
  const { data } = await response.json();
  if (data?.clinicId) await deleteTestClinic(request, data.clinicId);
}

// Signs the given page in as the fixed E2E test user via a freshly minted
// Firebase custom token — the automated stand-in for clicking through
// Google's real sign-in popup (see /api/test-auth/token and /test-auth for
// why this is safe to run against production). Lands on whichever of
// /home or /onboarding the app itself decides, exactly like a real sign-in.
export async function signInAsTestUser(page: Page, request: APIRequestContext): Promise<void> {
  const response = await request.post(`${APP_BASE}/api/test-auth/token`, {
    headers: { "x-test-auth-secret": testAuthSecret() },
  });
  expect(response.ok(), `POST /api/test-auth/token failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  const { data } = await response.json();

  await page.goto(`/test-auth?token=${encodeURIComponent(data.token)}`);
  await page.waitForURL(/\/(home|onboarding)/, { timeout: 15_000 });
}
