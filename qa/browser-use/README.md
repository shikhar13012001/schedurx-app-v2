# ScheduRx Browser QA

Runnable, human-in-the-loop browser journeys for ScheduRx staging. The harness drives Chrome directly via the
[browser-harness](https://github.com/browser-use/browser-harness) CDP CLI — **no LLM API key is required** and
there are no per-run usage limits. One visible Chrome session is used; terminal gates wrap authentication and
live mutations.

Targets are deliberately locked to:

- Staff dashboard: `https://app.schedurx.com`
- Patient app: `https://book.schedurx.com`
- Seeded clinic: `poc-clinic-001` (`Dr. Sharma's Clinic`)

The stale `schedurx-app-v1.vercel.app` deployment is neither allowlisted nor testable through this harness.

## Safety model

- Google credentials are never given to the agent. The harness opens a visible browser and asks the operator
  to complete login manually before Doctor or Clinic Owner journeys.
- Clinic-owner coverage is read-only. The harness does not add/delete routes, workflows, staff, or invites.
- Booking, rescheduling, and cancellation require command-line authorization flags plus an exact typed
  confirmation immediately before each live action.
- Twilio is live. A booking lifecycle can send real, billable SMS and WhatsApp messages—possibly one message
  per enabled channel for booking, reschedule, and cancellation.
- Patient phone numbers and capability IDs are redacted from JSON/Markdown reports. Browser history and optional
  visual artifacts can still contain patient data; use a dedicated test number.
- Visual artifacts are off by default. Enable them only after accepting their PII implications.

## Setup

Python 3.12 and `uv` are recommended. From this directory:

```powershell
# 1. Install the browser-harness CLI (once, globally)
uv tool install --python 3.12 --upgrade --force browser-harness

# 2. Enable Chrome remote debugging
#    Open chrome://inspect/#remote-debugging in Chrome and tick
#    "Allow remote debugging for this browser instance".
#    When Chrome prompts "Allow remote debugging?", click Allow.

# 3. Configure the QA harness
Copy-Item .env.example .env
# No API key is needed — review QA_STAFF_URL / QA_PATIENT_BASE_URL / clinic settings.

uv sync --python 3.12 --extra dev
```

Verify the CDP connection:

```powershell
browser-use --doctor
```

## Running journeys

Safe smoke test — invalid appointment IDs must render a genuine 404:

```powershell
uv run schedurx-browser-qa --journey smoke
```

Required-field testing — prompts for a patient phone but does not submit:

```powershell
uv run schedurx-browser-qa --journey patient-validation
```

Mandatory ₹120 token-payment flow. This creates a live test appointment and can send real messages:

```powershell
uv run schedurx-browser-qa `
  --journey patient `
  --allow-appointment-mutations `
  --allow-real-messages
```

The journey verifies this exact sequence:

1. Public booking without patient login.
2. Dr. Rahul Mehta and an available slot at least three days ahead.
3. Review screen before submission.
4. Mandatory redirect to `/<clinicId>/pay/<pendingBookingId>`.
5. ₹120 amount.
6. Stripe test checkout using `4242 4242 4242 4242`.
7. Return to `book.schedurx.com` with "Payment received".

After payment, paste the capability/manage link received through messaging when prompted. Read-only manage-page
verification runs automatically. Reschedule and cancellation are additional, separately gated actions:

```powershell
uv run schedurx-browser-qa `
  --journey patient `
  --allow-appointment-mutations `
  --allow-real-messages `
  --include-reschedule `
  --include-cancel
```

Staff read-only journeys:

```powershell
uv run schedurx-browser-qa --journey doctor
uv run schedurx-browser-qa --journey admin
```

For each staff journey the browser opens `app.schedurx.com`, then the terminal asks you to complete Google login
and press Enter. If switching roles, log out in the visible browser before authenticating the next account.

Full suite:

```powershell
uv run schedurx-browser-qa `
  --journey all `
  --allow-appointment-mutations `
  --allow-real-messages
```

Inspect configuration and safety policy without launching a browser:

```powershell
uv run schedurx-browser-qa --journey all --allow-appointment-mutations --allow-real-messages --dry-run
```

## Results

Each run writes redacted reports under `.artifacts/<UTC timestamp>/`:

- `report.md` — human-readable checks, evidence, and concerns.
- `report.json` — machine-readable structured result.
- Per-journey raw CDP stdout/stderr logs (`<journey_id>.log`).

A journey result is not treated as passed merely because it reached the end. Each check requires visible evidence
for its assertions and ambiguous UI is reported as failed or blocked.

## Architecture

```
CLI (cli.py)
  → safety gates (safety.py)
  → journey script string (journeys.py)
  → runner (runner.py) prepends cdp_helpers.py, pipes to `browser-harness` subprocess
  → parses JOURNEY_RESULT_JSON: line from stdout
  → ScenarioRecord → reporting (reporting.py) writes redacted report.md + report.json
```

No `browser_use` Python library, no Cloud API key, no LLM in the loop. Chrome is driven entirely through CDP
commands (`Accessibility.getFullAXTree`, `DOM.getBoxModel`, `click_at_xy`, `fill_input`, etc.).