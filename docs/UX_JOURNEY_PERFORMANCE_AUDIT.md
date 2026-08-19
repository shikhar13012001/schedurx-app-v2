# ScheduRx UX, journey, consistency, and performance audit

Date: 2026-08-18

Scope: source-level review of the current frontend, with the calendar and its booking/blocking journeys as the primary focus. Adjacent onboarding, online-consult, patient, profile, shell, query, and PWA code was reviewed where it changes what the calendar promises or receives. No product code was changed.

## Executive summary

The calendar has a strong visual foundation, but it is not yet safe as an operational scheduling surface. The most serious issues are not cosmetic:

- The booking form collects consultation mode and token-payment intent, then drops both values before the API request. The UI can therefore confirm behavior that did not happen.
- The time selector generates timetable increments, not actual availability. Booked and blocked periods remain selectable, so the primary booking journey permits avoidable conflicts.
- Appointment data has no realtime subscription or fallback polling. With window-focus refresh disabled globally, a calendar left open can remain stale while another staff member or automation changes the schedule.
- Onboarding collects slot length, medical registration number, split clinic hours, and team invitations but does not persist those choices as represented. The user's first-run configuration and the later scheduling behavior can disagree immediately.
- Loading and request failure are generally rendered as legitimate empty states. In a clinic, “there are no appointments” and “appointments could not be loaded” must never look identical.

These should be resolved before visual refinements because they affect booking correctness, staff trust, payment expectations, and remote-consult availability.

## Severity model

- **Critical**: can create incorrect bookings, misrepresent a completed action, or hide current operational data.
- **High**: materially obstructs a common journey, creates data-integrity risk, or fails accessibility for a core action.
- **Medium**: causes confusion, avoidable friction, inconsistent behavior, or scaling problems that will become visible with real clinic data.
- **Low**: polish, maintainability, or quality-control gap with limited immediate user impact.

## Findings

### Critical

#### UX-01 — Consultation mode and token-payment choices are discarded

**Evidence:** `src/components/clinic/booking-sheet.tsx:84-87` tracks `mode`, doctor, day, and time; `src/components/clinic/booking-sheet.tsx:109-117` submits only doctor, start, reason, and patient. The store input at `src/stores/index.ts:85-88` has no `mode` or `pay` fields. The adapter then hard-defaults every server appointment to `mode: "clinic"` and `pay: "unpaid"` at `src/lib/adapters.ts:135-139`, even though `prisma/schema.prisma:103-107` and `docs/BACKEND_MASTER_CONTEXT.md:24` describe those capabilities.

**User impact:** A receptionist can select Video, Audio, or Text and enable the ₹100 token flow, receive a success message saying the link was sent, yet create an in-clinic, unpaid appointment. Online-consult cards and join actions then never appear because the appointment is read back as in-clinic.

**Journey affected:** Calendar/Home/Patients → New appointment → confirmation → Online consults/Billing.

#### UX-02 — “Time” presents schedule increments, not available slots

**Evidence:** `buildSlotOptions` in `src/components/clinic/booking-sheet.tsx:40-54` only applies clinic hours, slot duration, and “not in the past.” The booking sheet never queries appointments or block windows before rendering `slotOptions` at `src/components/clinic/booking-sheet.tsx:89-102` and `:166-170`.

**User impact:** Already-booked and blocked times remain selectable. The label and empty message (“No slots left today”) imply availability checking that does not exist. A server rejection would arrive only after the full form is completed; if the server does not enforce overlap, double-booking is possible.

**Journey affected:** Every appointment creation entry point.

#### UX-03 — Open calendars can remain stale during multi-staff operation

**Evidence:** `src/hooks/use-appointments.ts:15-22` has no polling or realtime subscription. The global query client disables focus refresh at `src/lib/query-client.ts:8-10`. Only mutations made through this browser invalidate appointment queries (`src/stores/index.ts:142-149`). Queue data has a realtime channel and 30-second safety poll (`src/hooks/use-queue.ts:25-32`), but appointments do not.

**User impact:** A doctor, receptionist, AI caller, or another device can add or block a slot while an already-open calendar continues showing the old state. Combined with UX-02, this creates a high-probability conflict path.

**Journey affected:** Reception/doctor concurrent scheduling, AI-assisted booking, and long-running PWA sessions.

#### UX-04 — Onboarding captures configuration that is not actually applied

**Evidence:** Onboarding collects slot length and registration number at `src/app/onboarding/page.tsx:36-38` and `:170-175`, split morning/evening hours at `:42` and `:208-225`, and team invitations at `:39-41` and `:181-203`. The final request at `:68-78` does not send slot length, registration number, invitations, the morning end, or the evening start. It reduces split hours to a single opening/closing span. The success toast at `:95` says invitations were “noted,” but they are only local state and disappear.

**User impact:** A clinic that configures 15-minute slots and a lunch break can emerge with a different slot duration and bookable lunch hours. A doctor may reasonably believe their registration number and invitations were saved when they were not.

**Journey affected:** Sign-up → clinic configuration → first calendar/booking/team experience.

### High

#### UX-05 — Loading, failure, and genuine empty states are indistinguishable

**Evidence:** The calendar destructures query data to an empty array at `src/app/(app)/calendar/page.tsx:124` and immediately renders the timeline. Most list pages use the same pattern. Searches for query-state handling find almost no `isError` use and only detail-route loading handling. The app shell itself renders an unlabelled blank viewport during hydration/auth resolution at `src/app/(app)/layout.tsx:90`.

**User impact:** A failed or slow request looks like an empty clinic day, empty queue, no patients, or no consults. Staff cannot tell whether it is safe to act, retry, or wait.

#### UX-06 — Existing calendar events are a dead end

**Evidence:** Appointment and blocked-time elements stop click propagation but provide no click action (`src/app/(app)/calendar/page.tsx:35-37` and `:59-61`). There is no route or sheet from the calendar for viewing, editing, cancelling, rescheduling, checking in, joining, or opening the patient file.

**User impact:** The calendar supports creating entries but not managing them. Staff must leave the scheduling context and hunt through other sections for the next action, if that action exists at all.

#### UX-07 — Concurrent or overlapping events cover one another

**Evidence:** Every event is absolutely positioned at full width using `absolute inset-x-0` (`src/app/(app)/calendar/page.tsx:37` and `:62`). There is no collision grouping or column layout.

**User impact:** Overlapping appointments, tentative holds, or a block laid over a booking visually obscure one another. The event rendered later can completely hide the earlier one.

#### UX-08 — The calendar starts far from the current time and uses a fixed 14-hour canvas

**Evidence:** The timeline is hard-coded from 08:00 to 22:00 at `src/app/(app)/calendar/page.tsx:14-17`, producing a roughly 1,193-pixel canvas. The page does not scroll the current-time line into view. Clinic/doctor hours are available elsewhere but do not control this range.

**User impact:** In an afternoon or evening clinic, opening Calendar starts the user many screens above the operational moment. The long mobile scroll also separates the selected day/doctor and create actions from the current appointments.

#### UX-09 — Blocking time permits invalid/risky inputs without preview or confirmation

**Evidence:** `src/components/clinic/block-time.tsx:29-45` accepts today plus any time, applies fixed 1–4 hour presets, and submits immediately. It does not prevent a past time today, enforce clinic closing time, show affected appointments, ask for confirmation before triggering reschedule calls, or disable the button while the async request is active. The explanatory copy promises automatic reschedule calls at `:49` before the user sees any impact.

**User impact:** A double click can submit twice; a block can be in the past or extend outside hours; and a destructive action affecting booked patients has no review step.

#### UX-10 — Patient auto-fill can retain the wrong person's name

**Evidence:** The known-patient lookup memo depends only on `phone`, not on asynchronously loaded `PATIENTS` (`src/components/clinic/booking-sheet.tsx:80-82`). When a known number fills a name and the phone is then changed to an unknown number, there is no logic to clear or revalidate the filled name.

**User impact:** A booking can be created for a new phone number with the previous known patient's name, creating patient-record ambiguity.

#### UX-11 — Core calendar controls are not keyboard-equivalent or state-announced

**Evidence:** The click-to-book timeline is a `div` with `onClick` and no keyboard handler, role, focusability, or accessible instruction (`src/app/(app)/calendar/page.tsx:205-209`). Day, doctor, and mode selectors are visually selected buttons without `aria-pressed`/selected semantics (`calendar/page.tsx:156-184`, `booking-sheet.tsx:135-159`). The shared sheet cancels Radix's automatic focus placement at `src/components/ui/sheet.tsx:20`.

**User impact:** Keyboard and assistive-technology users cannot perform the same “tap an empty time” action or reliably identify selected day, doctor, and consultation mode. Opening a modal may leave focus context unclear.

#### UX-12 — The app disables browser zoom

**Evidence:** `src/app/layout.tsx:16-21` sets `maximumScale: 1`.

**User impact:** Users with low vision cannot pinch-zoom the dense timeline, small time labels, and 10–12 px secondary text.

### Medium

#### UX-13 — Date navigation is limited and becomes incorrect across midnight

**Evidence:** The day strip is created once for yesterday through five days ahead (`src/app/(app)/calendar/page.tsx:107-118`) and has no date picker, previous/next week, or “Today” recovery control. `isToday` is positional (`dayIndex === 1`), not a comparison to the actual date. The date array is never regenerated.

**User impact:** Staff cannot inspect older schedules or book beyond five days from Calendar. If the installed app remains open across midnight, the old date is still labelled/treated as today and can receive the current-time line.

#### UX-14 — Calendar hours and booking hours use different sources of truth

**Evidence:** The calendar uses hard-coded 08:00–22:00 (`calendar/page.tsx:14-17`). Booking uses clinic-level opening/closing hours (`booking-sheet.tsx:90-92`). Doctor data includes working hours (`src/lib/adapters.ts:28-30`, `:45`), but neither calendar positioning nor slot generation applies them.

**User impact:** The timeline can show hours that cannot be booked, while the booking form can offer times when the selected doctor is not working. Split shifts are flattened during onboarding (UX-04), further increasing disagreement.

#### UX-15 — Status and payment meaning is visually ambiguous

**Evidence:** Completed, no-show, and cancelled appointments share the same opacity treatment (`calendar/page.tsx:213-218`). Critical state is a small colored dot/ring; token is a bare ₹ glyph; remote mode uses the same Video icon for audio and video (`:73-83`). There is no legend or textual status inside the event.

**User impact:** Staff cannot reliably distinguish outcomes or modalities at a glance, especially with color-vision limitations. A cancelled slot may look merely completed.

#### UX-16 — Online consult grouping is time-inaccurate even after mode persistence is fixed

**Evidence:** Consults requests all appointments with no date filter (`src/app/(app)/consults/page.tsx:21-34`) but the empty state says “today” (`:112`). `startingSoon` is `mins < 90` (`:116-130`), so any past appointment—including one days old—qualifies and is labelled “Starting now.” There is no live timer interval on this page.

**User impact:** Past remote visits can remain visually urgent, upcoming countdowns can become stale, and the page title/body disagree about scope.

#### UX-17 — Repeated whole-dataset subscriptions and linear lookups scale poorly

**Evidence:** Each calendar event mounts its own `usePatients()` subscription and scans the patient array (`calendar/page.tsx:24-27`). Each queue row mounts both `usePatients()` and unscoped `useAppointments()` and performs two scans (`src/components/clinic/queue.tsx:21-36`). Query caching avoids duplicate network requests, but not the subscriber count, mapping work, and repeated lookup cost.

**User impact:** Realtime invalidations or cache refreshes cause every row/block subscriber to update and repeat linear searches. The cost grows with both appointments and patients.

#### UX-18 — Several screens fetch unbounded datasets and paginate only after download

**Evidence:** `useAppointments()` supports date/doctor filters but Consults and Analytics call it without either. `usePatients()` has no page parameter (`src/hooks/use-patients.ts:9-19`). Desktop patient pagination is client-side (`src/components/ui/data-table.tsx:27-38`), while mobile renders every returned patient (`src/app/(app)/patients/page.tsx:61-81`).

**User impact:** Network payload, adapter work, memory, and mobile DOM size grow with the entire clinic history. This will degrade first on older phones and long-running clinics.

#### UX-19 — Heavy closed-sheet dependencies are loaded with the calendar route

**Evidence:** Calendar statically imports `BookingSheet` and `BlockTimeSheet` (`calendar/page.tsx:5-6`). `BookingSheet` eagerly brings React Hook Form, Zod, phone-number input, Radix Sheet, and associated code even when the user never opens it. All app pages and the app shell are client components.

**User impact:** The first Calendar navigation pays for form/modal functionality that is initially hidden. The client-only shell also displays a blank screen until persisted session hydration completes.

#### UX-20 — The implementation contradicts the repository's own typography/density brief

**Evidence:** `docs/REDESIGN_DIRECTIVE_v2.md` asks for 28–32 px page titles and 15–16 px body text. Calendar uses a 44.8–67.2 px title (`calendar/page.tsx:145-148`) and multiple 10–13 px labels/details (`:166-167`, `:178-180`, `:197-200`). The same oversized-title/small-supporting-copy pattern appears across routes.

**User impact:** The large heading consumes scarce mobile space while operational labels remain difficult to scan. This recreates the density/legibility problem the redesign brief aimed to solve.

#### UX-21 — Registration number remains editable-looking but cannot be saved

**Evidence:** Profile renders registration number with `defaultValue` at `src/app/(app)/profile/page.tsx:157-164`, but `practiceDirty` and the save payload only track fee and slot duration (`:52-67`). The adapter also states that the backend field is missing (`src/lib/adapters.ts:41-43`).

**User impact:** A clinician can edit a compliance-relevant field and press Save, but the change is ignored.

#### UX-22 — PWA offline fallback can return the wrong content and its cache grows without a bound

**Evidence:** `public/sw.js:11-21` caches every same-origin GET and, on a miss, returns cached `/home` for any failed GET. There is no request-type filtering, maximum entries, or expiration.

**User impact:** A failed JavaScript/API/resource request can receive HTML for `/home`, producing confusing parse/runtime failures rather than a controlled offline state. Long-running installations can accumulate an unbounded cache.

### Low / quality-control gaps

#### UX-23 — The configured lint check does not run non-interactively

`npm run lint` opens Next.js's first-time ESLint configuration prompt because no ESLint configuration exists. `next.config.mjs:3-4` also permits production builds to ignore both ESLint and TypeScript errors. `npx tsc --noEmit` currently passes, but the production build is configured not to protect that state.

#### UX-24 — No automated test surface is defined

`package.json` contains dev/build/start/lint scripts only. There are no unit, integration, accessibility, or end-to-end scripts for the critical booking, blocking, onboarding, and role journeys.

#### UX-25 — PWA brand colors are inconsistent

`public/manifest.webmanifest:9-10` uses green background/theme colors, while `src/app/layout.tsx:21` uses an off-white theme color and the current UI tokens use orange as primary (`src/app/globals.css:22`). Installed splash/browser chrome can therefore feel unrelated to the in-app brand.

## Journey-level gaps

### New clinic to first booking

1. The user configures a slot duration, split hours, registration number, and optional team invites.
2. Several values are silently dropped (UX-04).
3. Calendar and booking use different hour models (UX-14).
4. The “available” time list ignores existing bookings/blocks (UX-02).
5. Mode/payment choices are silently dropped while the toast claims success (UX-01).

This journey currently produces false confidence at each transition.

### Receptionist managing a live day

1. Calendar can be stale while other staff or automation updates it (UX-03).
2. A request failure looks like an empty schedule (UX-05).
3. The current time may require a long scroll to reach (UX-08).
4. Existing events cannot be opened or managed (UX-06).
5. Overlaps hide information (UX-07).

The screen is visually calendar-like but is not yet a dependable control surface for a concurrent clinic.

### Remote consultation

1. Reception selects Video/Audio and may enable token payment.
2. Both selections are discarded (UX-01).
3. The adapter reads the appointment back as in-clinic/unpaid.
4. Online Consults filters it out entirely.
5. Once mode persistence is restored, the current all-history/“starting soon” logic still misclassifies past sessions (UX-16).

## Recommended order of correction

1. Preserve mode/payment and align the frontend, API contract, adapter, and backend schema.
2. Make availability server-authoritative and exclude appointments/blocks from the picker.
3. Add appointment freshness guarantees and visibly distinct loading/error/empty states.
4. Correct onboarding persistence and split-hours semantics.
5. Add calendar event management, collision layout, working-hours alignment, and current-time positioning.
6. Fix patient auto-fill and block-time safeguards.
7. Address keyboard semantics, focus management, zoom, and small-text usage.
8. Bound list queries, remove row-level dataset subscriptions, and lazy-load closed sheets.
9. Harden PWA caching and reinstate enforceable lint/type/test gates.

## Verification performed

- `npx tsc --noEmit`: passed.
- `npm run lint`: did not execute a lint audit; it opened the initial ESLint setup prompt.
- `http://127.0.0.1:3000/calendar`: local development server returned HTTP 200.
- Interactive browser inspection was not completed because the in-app browser connection could not be established in this environment. Visual/layout statements above are therefore derived from source and design tokens; functional/data-flow findings are directly traceable to the cited code.

