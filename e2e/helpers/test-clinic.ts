import type { APIRequestContext } from "@playwright/test";

// Direct backend calls (not through the UI) for specs that need *some*
// existing clinic to operate within but aren't themselves testing the
// onboarding flow — e.g. appointments.spec.ts wants a real clinic+doctor to
// book against, not a re-run of onboarding.spec.ts's own coverage. Every
// clinic created this way is named with the "[E2E]" prefix, which is the
// only thing DELETE /internal/clinic/:id will ever act on (see
// internal-clinic-onboarding.js) — the same safety gate protects fixtures
// created here as protects ones created by walking through the real UI.
const API_BASE = process.env.E2E_API_BASE_URL ?? "https://api.schedurx.com";
export const TEST_UID = "srx-e2e-test-user";

function internalApiKey(): string {
  const key = process.env.E2E_INTERNAL_API_KEY;
  if (!key) throw new Error("E2E_INTERNAL_API_KEY is not set in e2e/.env.test.local — see e2e/.env.test.local.example");
  return key;
}

export async function createTestClinic(
  request: APIRequestContext,
  overrides: Partial<{ clinicName: string; practiceType: "solo" | "polyclinic"; founderRole: "doctor" | "receptionist" }> = {},
): Promise<{ clinicId: string; doctorId: string | null; staffId: string }> {
  const clinicName = overrides.clinicName ?? `[E2E] Appointments ${Date.now()}`;
  const response = await request.post(`${API_BASE}/internal/clinic`, {
    headers: { Authorization: `Bearer ${internalApiKey()}` },
    data: {
      firebaseUid: TEST_UID,
      email: "e2e-test@schedurx.com",
      fullName: "E2E Test User",
      clinicName,
      practiceType: overrides.practiceType ?? "solo",
      founderRole: overrides.founderRole ?? "doctor",
    },
  });
  if (!response.ok()) throw new Error(`createTestClinic failed: ${response.status()} ${await response.text()}`);
  const { data } = await response.json();
  return { clinicId: data.clinic.id, doctorId: data.doctor?.id ?? null, staffId: data.staff.id };
}

export async function deleteTestClinic(request: APIRequestContext, clinicId: string): Promise<void> {
  const response = await request.delete(`${API_BASE}/internal/clinic/${clinicId}`, {
    headers: { Authorization: `Bearer ${internalApiKey()}` },
  });
  if (!response.ok()) {
    // Cleanup failing shouldn't fail the test that already ran — surface it
    // loudly instead so it doesn't accumulate silently.
    console.error(`deleteTestClinic(${clinicId}) failed: ${response.status()} ${await response.text()}`);
  }
}
