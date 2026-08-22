import { test, expect } from "@playwright/test";
import { purgeAnyStaleTestClinic, signInAsTestUser } from "./helpers/auth";
import { deleteTestClinic } from "./helpers/test-clinic";

// Covers the exact failure a real user hit in production: signing in,
// filling out the practice-setup screen, and submitting POST /api/onboarding
// — which was crashing with "Unexpected end of JSON input" whenever the
// backend proxy's fetch() failed uncaught (see src/lib/backend-proxy.ts).
// This test would have caught that regression before a real signup did.
let createdClinicId: string | null = null;

test.beforeAll(async ({ request }) => {
  await purgeAnyStaleTestClinic(request);
});

test.afterEach(async ({ request }) => {
  if (createdClinicId) {
    await deleteTestClinic(request, createdClinicId);
    createdClinicId = null;
  }
});

test("a new user can sign in and complete the practice-setup step without error", async ({ page, request }) => {
  await signInAsTestUser(page, request);

  // A fresh test uid with no clinic yet lands on /onboarding, same as any
  // real first-time sign-in — asserting this catches a regression in that
  // routing decision too, not just the submit itself.
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByText("How is your", { exact: false })).toBeVisible({ timeout: 15_000 });

  await page.getByText("Solo practice", { exact: false }).click();
  const clinicName = `[E2E] Onboarding ${Date.now()}`;
  await page.getByPlaceholder("e.g. Nirmaya Clinic").fill(clinicName);

  const onboardingResponse = page.waitForResponse((r) => r.url().includes("/api/onboarding") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Continue" }).click();
  const response = await onboardingResponse;

  // This is the assertion that would have failed loudly, with a real
  // status code and body, instead of the browser throwing a raw
  // SyntaxError with no indication of what actually went wrong.
  expect(response.status(), await response.text().catch(() => "")).toBeLessThan(400);
  const body = await response.json();
  expect(body.success, JSON.stringify(body)).toBeTruthy();
  createdClinicId = body.data.clinic.id;

  // Submitting this screen should always move the wizard forward, whatever
  // its next screen turns out to be — never leave the user stuck on the
  // same practice-setup screen they just submitted.
  await expect(page.getByText("How is your", { exact: false })).not.toBeVisible({ timeout: 15_000 });
});
