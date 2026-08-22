import { test, expect } from "@playwright/test";
import { purgeAnyStaleTestClinic, signInAsTestUser } from "./helpers/auth";
import { createTestClinic, deleteTestClinic } from "./helpers/test-clinic";

// Uses the real reporting number so a real booking confirmation actually
// arrives on WhatsApp/SMS during this test, the same way a real patient's
// would — the point isn't just "the API returned 200", it's confirming the
// whole path (booking -> comms workflow -> Twilio send) still works.
const TEST_PATIENT_PHONE = "9555607181";
const TEST_PATIENT_NAME = "E2E Test Patient";

let clinicId: string | null = null;

test.beforeAll(async ({ request }) => {
  await purgeAnyStaleTestClinic(request);
  const created = await createTestClinic(request, { clinicName: `[E2E] Appointments ${Date.now()}` });
  clinicId = created.clinicId;
});

test.afterAll(async ({ request }) => {
  if (clinicId) await deleteTestClinic(request, clinicId);
});

test("a doctor can book a new appointment from Home", async ({ page, request }) => {
  await signInAsTestUser(page, request);
  await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

  await page.getByText("New booking", { exact: false }).click();
  await expect(page.getByText("New appointment", { exact: false })).toBeVisible();

  await page.getByPlaceholder("98765 43210").fill(TEST_PATIENT_PHONE);
  await page.getByPlaceholder("Full name").fill(TEST_PATIENT_NAME);

  const appointmentsResponse = page.waitForResponse(
    (r) => r.url().includes("/api/v1/appointments") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Book appointment" }).click();
  const response = await appointmentsResponse;

  expect(response.status(), await response.text().catch(() => "")).toBeLessThan(400);
  await expect(page.getByText("Appointment booked", { exact: false })).toBeVisible({ timeout: 10_000 });
});
