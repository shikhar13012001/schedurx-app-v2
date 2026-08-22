import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: "e2e/.env.test.local" });

// Runs against the real production app.schedurx.com / api.schedurx.com by
// design (see e2e/README.md) — there's no separate staging environment.
// Every spec creates and cleans up its own "[E2E]"-prefixed test clinic
// (see e2e/helpers/) rather than sharing one signed-in session across
// files, since the one fixed test Firebase user can only ever safely own
// one clinic at a time (Staff.firebaseUid is 1:1 — see
// internal-clinic-onboarding.js's by-firebase-uid lookup). That's why
// fullyParallel is off: two specs racing to own that one uid's Staff row
// at once would corrupt each other's runs, not just slow things down.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://app.schedurx.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
