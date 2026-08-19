# ScheduRx — Clinic Command Center

The staff-facing clinic dashboard: onboarding, calendar, consults, patients, billing, automations, and an in-app AI assistant. This is one of three separate repos/deployments that make up ScheduRx — see [Related repos](#related-repos) below.

## Setup

```bash
cp .env.local.example .env.local   # fill in real values, see below
npm install
npm run dev   # http://localhost:3000
```

### Environment variables

See `.env.local.example` for the full list, each documented inline. In short:

- `NEXT_PUBLIC_API_BASE_URL` — the backend (`schedurx-backend`) this app talks to for everything except its own two thin proxy routes.
- `NEXT_PUBLIC_FIREBASE_*` — Firebase Web config (same project as the backend), public by design.
- `INTERNAL_API_KEY` — server-only, must match the backend's `INTERNAL_API_KEY` exactly.
- `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY_BASE64` — server-only Firebase Admin credentials (same service account the backend uses), used to verify a caller's real ID token before `/api/onboarding` or `/api/invite/[token]/accept` ever trust a uid.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Realtime queue subscription; falls back to polling without it.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — optional, enables push notifications.
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) — optional error tracking, inert without a DSN.

## Scripts

```bash
npm run dev          # local dev server
npm run build         # production build
npm run start          # serve a production build
npm run lint            # ESLint
npm run typecheck        # tsc --noEmit (strict mode)
npm run format:check      # Prettier check
npm run format             # Prettier write
npm run test                 # vitest
npm run verify                 # lint + typecheck + test — the pre-deploy gate
```

## Deployment

A `Dockerfile` is provided (multi-stage, `output: "standalone"`, runs as non-root) — not build-verified in this environment (no Docker daemon available at the time it was added); verify with `docker build .` before relying on it. `.github/workflows/ci.yml` runs lint/typecheck/test/build on every push and PR to `main` (format-check is informational only for now — the existing codebase predates Prettier and hasn't had a full reformat pass).

`next.config.mjs` sets security headers (CSP, HSTS, X-Frame-Options, etc.) and disables `X-Powered-By`. Adjust the CSP's `connect-src` if the backend origin or any third-party endpoint this app calls changes.

## Where things live

- `src/stores/index.ts` — the client-side data contract (Zustand), backed by the real API via `src/lib/api-client.ts`.
- `src/lib/firebase-admin.ts` — server-only Firebase Admin SDK, verifies ID tokens for the two proxy routes below.
- `src/app/api/onboarding/route.ts`, `src/app/api/invite/[token]/**` — this app's own thin server-side proxies to the backend's `INTERNAL_API_KEY`-gated bootstrap endpoints; the key never reaches the browser, and the caller's uid is always taken from a server-verified ID token, never a client-supplied field.
- `docs/BACKEND_MASTER_CONTEXT.md` — backend context: endpoints, realtime, AI pipelines, compliance.
- `public/sw.js`, `manifest.webmanifest` — PWA (installable, offline shell, push).
- `TEST_PLAN.md` — a full manual QA/UAT script covering every built feature across all three repos, from onboarding through the WhatsApp/voice patient-facing channels.

## Related repos

ScheduRx is three separate git repositories, not a monorepo:

1. **This repo** — the staff dashboard.
2. **`schedurx-backend`** — the Node/Express API everything flows through (Twilio, nettu-scheduler, OpenAI, ElevenLabs). Deployed on a DigitalOcean droplet.
3. **`schedurx-form-agent`** — the patient-facing appointment booking site, a thin client of `schedurx-backend`'s public API. Deployed separately on Vercel.
