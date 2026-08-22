# E2E tests (Playwright)

Real browser tests that sign in, walk through the actual UI, and hit the real
production backend at `app.schedurx.com` / `api.schedurx.com` — there's no
separate staging environment. That's a deliberate choice (see the parent
conversation): it catches real integration issues (DNS, TLS, real Twilio
sends) that a staging environment could hide, at the cost of needing real
care around what these tests are allowed to touch.

## Safety model

- **Auth**: real Google sign-in can't be driven by an automated browser
  reliably, so tests sign in via `POST /api/test-auth/token` — a
  secret-gated endpoint that mints a Firebase custom token for exactly one
  fixed, disposable test account (`srx-e2e-test-user`), never an arbitrary
  uid. The secret (`TEST_AUTH_SECRET`) is unset by default, which fails the
  endpoint closed (returns a plain 404, indistinguishable from a route that
  doesn't exist).
- **Data**: any clinic these tests create is named with an `[E2E]` prefix.
  The backend's `DELETE /internal/clinic/:id` refuses to touch anything
  *not* named that way, regardless of caller — so a bug in a test, or even a
  leaked `INTERNAL_API_KEY`, can never delete a real clinic's data.
- **Cleanup**: `Staff.firebaseUid` is 1:1 (a query that assumes at most one
  row errors otherwise), so the fixed test uid can only safely own one
  clinic at a time. Every spec purges whatever clinic that uid is currently
  attached to *before* creating its own (`purgeAnyStaleTestClinic`) — this
  makes the suite self-healing even if a previous run crashed before its own
  `afterAll` cleanup ran, rather than slowly accumulating orphaned test
  clinics.

## One-time setup

1. Add `TEST_AUTH_SECRET` to Vercel's **production** env vars (the dashboard
   needs it to answer `/api/test-auth/token` at all). Ask whoever set this up
   for the value, or generate a new one and update both places:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Copy `.env.test.local.example` to `.env.test.local` and fill in:
   - `TEST_AUTH_SECRET` — same value as step 1.
   - `E2E_INTERNAL_API_KEY` — the backend's real `INTERNAL_API_KEY` (from the
     droplet's `.env`). Lets tests create/purge their own test clinics
     directly instead of only through the UI.
3. `npx playwright install chromium` (downloads the browser binary once).

## Running

```
npm run test:e2e        # headless, CI-style
npm run test:e2e:ui     # Playwright's interactive UI mode — good for writing/debugging specs
```

Tests run serially (`workers: 1` in `playwright.config.ts`), not in parallel
— they all share the one test account, so two specs racing to own its
Staff row at once would corrupt each other's runs.

## What's covered today

- `onboarding.spec.ts` — sign in, fill out the practice-setup screen, submit.
  This is the exact path that broke in production (an uncaught fetch()
  failure crashing the request with an empty response body) — this test
  exists specifically so that regresses loudly next time instead of quietly
  reaching a real signup.
- `appointments.spec.ts` — book a new appointment from Home, using a real
  phone number so a real WhatsApp/SMS confirmation goes out, confirming the
  whole path (not just the API response) still works.

## Adding more journeys

Follow the same shape: `purgeAnyStaleTestClinic` (if creating a clinic),
sign in via `signInAsTestUser`, create fixtures via `createTestClinic` if the
journey doesn't itself test onboarding, assert on both a real network
response *and* what the UI shows, clean up in `afterAll`. Reasonable next
candidates: reschedule/cancel an appointment, open a consult thread and send
a message, accept a team invite, toggle the theme.
