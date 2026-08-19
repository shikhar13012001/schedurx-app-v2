# ScheduRx — Full Product Test Plan

A manual QA / handover script covering the whole product: the staff dashboard (this repo), the patient-facing WhatsApp AI agent, the missed-call voice/SMS follow-up, and the patient booking site (`schedurx-form-agent`, deployed separately on Vercel). Written so a client doctor or their staff can click through every real workflow before trusting it with real patients.

## How to read this

**Status legend**

- ✅ **Verified live** — proven end-to-end with real data during this build (a real WhatsApp message delivered, a real appointment booked against the real calendar, a real voice call, etc.). This means the underlying API and integration are correct. It does **not** always mean a human physically clicked the on-screen button in a browser — some of this was verified by driving the same API calls the UI makes and confirming the result (delivered messages, correct DB state, correct rendered HTML). Treat these as low-risk to re-check, not zero-risk.
- 🔲 **Needs manual test** — the code exists and was built to spec, but nobody has clicked through it for real yet. Start here when you only have limited time.
- 🔴 **Known issue** — something concretely wrong, found and either fixed or left open (see the Known Gaps section at the end).

**Roles**

Three roles exist server-side: `owner`, `doctor`, `receptionist`. The dashboard's own UI only distinguishes two — the person who onboards (or accepts a "doctor" invite) is shown the full **doctor** UI regardless of whether they're the actual clinic owner underneath; a **receptionist** invite gets a reduced UI. This matters because a few actions (Automations, clinic settings) are gated server-side to the literal `owner` role — a second invited doctor sees the same screens as the owner but will get a "Only the clinic owner can change this" toast if they try to save one of those. Test this distinction explicitly (Scenario 3.3).

**Test data**: the demo clinic used throughout this build is `poc-clinic-001` ("Dr. Sharma's Clinic") on the real backend at `139.59.34.211:4000`. Prefer creating a **fresh clinic** via Scenario 1 for handover testing rather than reusing this one, so nothing collides with residual demo data.

---

## Part 1 — Staff dashboard

### 1. Onboarding — new clinic signup

**Role**: none (pre-auth) · **Path**: `/onboarding`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 1.1 | Create a solo-practice clinic | Open `/onboarding`. Step "Name your clinic": enter a clinic name, choose **Just me**. Step "About you": enter your name, specialization, fee, slot length. Step "Your usual hours": set morning/evening hours, tap **Enter ScheduRx**. Sign in with Google when prompted. | A Google sign-in popup appears once; after it, the app creates the clinic + your doctor profile and lands you on `/home` with your clinic name shown. A toast reads "Your clinic is live on ScheduRx." | 🔴→✅ **Fixed this session** — see below |
| 1.2 | Create a multi-doctor (polyclinic) clinic | Same as 1.1, but choose **A team** at step 1 — an extra "Invite your team" step appears before hours, where you can queue up teammate emails (optional, can skip). | Same successful outcome as 1.1; queued invites show a toast noting they still need to be sent properly from Team once the clinic exists (this step only *notes* invites, see 1.4). | 🔲 Needs manual test |
| 1.3 | Required-field validation | On the "Name your clinic" step, leave the name blank and try to continue. Same on "About you" with name/specialty blank. | **Continue** stays disabled until the required fields are filled — no error toast needed, the button simply won't advance. | 🔲 Needs manual test |
| 1.4 | Queued invites don't silently do anything | Complete onboarding as a polyclinic with 1+ invite queued at step 3. | After landing on `/home`, a toast explicitly says these invites were only *noted* and must be sent for real from Team. Go to Team and send them there (Scenario 8). | 🔲 Needs manual test |

**🔴 Known issue found and fixed this session**: `onboarding/page.tsx` was calling the wrong endpoint (`api.post("/api/onboarding", ...)`, which resolves to the **backend's** origin where no such route exists — confirmed live with a 404). It's been fixed to call this app's own `/api/onboarding` proxy route directly (the same pattern `invite/[token]/page.tsx` already used correctly), which forwards to the backend's real `/internal/clinic` endpoint. Verified live post-fix: the request now correctly reaches the backend (confirmed via a real proxy call that got a structured Firebase-auth error rather than a 404). **A full real onboarding run with a genuine Google account has not been done since the fix — do this first**, since it's the very first thing any new clinic will do.

### 2. Team invite acceptance (second staff member)

**Role**: none (pre-auth, invited) · **Path**: `/invite/[token]`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 2.1 | Accept a valid invite | From an already-onboarded clinic, send a real invite from Team (Scenario 8.1) to a phone number you can receive WhatsApp on. Open the link it sends, sign in with a **different** Google account than the clinic owner. | "Join {clinic} as a {doctor / front desk}" screen, then after **Continue with Google**, lands on `/home` already scoped to that clinic with the invited role. | 🔲 Needs manual test |
| 2.2 | Invalid / expired / already-used invite | Open `/invite/some-fake-token`. | "This invite isn't valid" message, no crash. | 🔲 Needs manual test |
| 2.3 | Accept the same invite twice | Complete 2.1, then open the same link again. | Should behave like 2.2 (invite already consumed) — confirm it doesn't silently create a duplicate Staff row. | 🔲 Needs manual test — the backend already has a test proving a second `accept` on the same token fails (`staff-invite-service.test.js`), but the UI path through this hasn't been clicked. |

### 3. Login, session, and role-based nav

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 3.1 | Doctor/owner nav | Log in as the clinic owner (created in Scenario 1). | Full nav: Home, Calendar, Consults, Patients, Analytics, Tasks, Team, AI activity, Billing, Automations, Notifications, Profile. | 🔲 Needs manual test |
| 3.2 | Receptionist nav | Log in as an invited receptionist. | Nav hides **Automations** entirely, and hides **Analytics** unless the owner has turned on "Reception analytics" in Profile → Practice (Scenario 15.4). | 🔲 Needs manual test |
| 3.3 | Non-owner doctor hitting an owner-only save | Invite a second person as **doctor** (not the original owner). Log in as them, go to Automations, change something, and save. | The Automations page itself is visible (only `receptionist` is blocked from it client-side), but the save fails with a toast: "Only the clinic owner can change this." This is the intentional owner-vs-doctor distinction described above — confirm it actually surfaces this way rather than silently failing or silently succeeding. | 🔲 Needs manual test |
| 3.4 | Log out | Profile → tap the logout icon (top right of the header). | Returns to `/`, session cleared, revisiting any `/app` route bounces back to login. | 🔲 Needs manual test |

### 4. Calendar

**Path**: `/calendar`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 4.1 | View today's schedule | Open Calendar. | Today's day chip is pre-selected (middle of the 7-day strip); the timeline shows 8am–10pm with a live "now" line. Appointments render as orange chips positioned by time. | 🔲 Needs manual test |
| 4.2 | Switch doctor / day | Tap a different day chip; tap a different doctor pill. | Timeline reloads scoped to that exact day + doctor (not everything ever booked). | 🔲 Needs manual test |
| 4.3 | Book by tapping an empty slot | Tap an empty area of the timeline. | A "New appointment" sheet opens pre-filled with the tapped time, snapped to the doctor's slot length. Fill patient phone/name, pick mode, day, time, optionally toggle "Lock slot with token," tap **Book appointment**. | ✅ Verified live — the underlying `bookAppointment` flow (patient lookup/create, nettu event, WhatsApp confirmation) was exercised repeatedly with real data this session, including through the equivalent public booking API. |
| 4.4 | Tap a booked chip → reschedule | Tap an existing booked (non-blocked) chip. | An "Appointment" action sheet opens with **Reschedule** / **Cancel appointment**. Tap Reschedule → a sheet with day/time picker (grid of the doctor's slot length) opens; pick a new time, tap **Reschedule**. | ✅ Verified live — reschedule was tested repeatedly this session via the same backend call this UI makes, including a real appointment moving from one real time to another with a WhatsApp notice sent. |
| 4.5 | Cancel from Calendar | From the same action sheet, tap **Cancel appointment**. | A browser confirm dialog ("Cancel this appointment? The patient will be notified.") — confirm it. Chip disappears / greys out, toast "Appointment cancelled." | ✅ Verified live — cancel flow proven with real data this session (same underlying call). |
| 4.6 | Block time | Tap the block-time icon (top right). | Sheet with date/from-time/duration presets (1h/2h/3h/4h) + optional reason. Submitting creates a striped/hatched orange block on the timeline that new bookings can't land inside. Copy warns anyone already booked in that window gets an automatic reschedule call — confirm this is really what happens or whether it's aspirational copy. | 🔲 Needs manual test — **note the copy claim above may be ahead of what's actually implemented; verify a blocked-over booking really does trigger an automatic reschedule, not just a UI warning.** |
| 4.7 | Past-day is read-only | Navigate to a day before today. | Booking taps are disabled (banner: "Past day · read-only"), chips still visible but dimmed for completed/cancelled/no-show. | 🔲 Needs manual test |

### 5. Consults

**Path**: `/consults`, `/consults/[id]`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 5.1 | Conversations inbox | Open Consults → **Conversations** tab. | List of patient threads sorted with critical-triage ones first, unread badge, "Needs attention"/"Needs reply"/"Routine" triage labels, escalated flag if applicable. | 🔲 Needs manual test |
| 5.2 | Search conversations | Type a patient name into the search box. | List filters live. | 🔲 Needs manual test |
| 5.3 | Open a thread, read AI summary | Tap into a conversation. | Top card shows "ScheduRx read" with an AI-generated summary of the thread; if critical, a red "Needs attention" flag. Message bubbles below, grouped by sender (patient / AI / doctor). | 🔲 Needs manual test — thread AI summary/triage generation was exercised at the backend/data level this session (`classifyAndStoreTriage`), not clicked through this exact screen. |
| 5.4 | Doctor replies by text | As a doctor, type in the message bar at the bottom, hit send (or Enter). | Message appears in the thread and is delivered to the patient over WhatsApp. | ✅ Verified live — real outbound WhatsApp sends from a staff reply were confirmed delivered this session. |
| 5.5 | Doctor replies by voice | Tap the mic icon with the text field empty, speak, tap again to stop. | Recording transcribes via `/api/v1/media/transcribe` and fills the text box with the transcript — review/edit, then send as 5.4. | 🔲 Needs manual test — transcription endpoint itself is backend-tested; not exercised through this exact mic control. |
| 5.6 | Receptionist view is read + escalate only | Log in as receptionist, open a thread. | Input bar is replaced with "Front desk can read and escalate. Replies come from the doctor." A shield-alert button escalates the thread to the doctor (only shown if not already escalated). | 🔲 Needs manual test |
| 5.7 | Online (video/audio) consults tab | Open Consults → **Online** tab. | Any video/audio-mode appointments for today show here, sorted by start time, with a "Starting now"/"Starts in N min" treatment when close. Join button (video link) or call button (audio, `tel:` link). Doctor sees quick links to the patient file and prescription screen underneath. | 🔲 Needs manual test |

### 6. Now Serving (queue) & live encounter

**Where**: embedded on Home, `now-serving.tsx`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 6.1 | Empty queue state | With nobody checked in and no more appointments today. | "Queue is clear" message; if a later booking exists today, a "Next · {name} at {time}" chip shows underneath. | 🔲 Needs manual test |
| 6.2 | Add a walk-in | (Wherever the walk-in entry point is surfaced — Patients page "New patient booking" button opens the same BookingSheet in walk-in mode from some flows.) Add a walk-in patient. | They appear in the queue; existing patients by phone auto-fill the name from their file. | 🔲 Needs manual test |
| 6.3 | Doctor: recap mode (default) | With "Consultation capture" set to **Recap** (Profile → Clinical), tap **Recap** on the Now Serving card, speak a summary, tap again to finish. | A Visit record is created for the current patient today (if one doesn't exist yet) and the recap becomes its clinical note. Toast: "Recap saved to {name}'s file." | ✅ Verified live — the same `/api/v1/visits` create + `/recap` transcribe+note pipeline was proven with real audio this session (via ElevenLabs/OpenAI work), not through this literal button click. |
| 6.4 | Doctor: ambient capture mode | Switch "Consultation capture" to **Ambient** (Profile → Clinical). Open the live encounter (tap the arrow on Now Serving), tap the AI control to start listening, consult naturally, tap again to stop. | Same recap pipeline as 6.3, triggered via `toggleCapture` instead of the explicit recap button. Toast: "Visit context ready." | 🔲 Needs manual test |
| 6.5 | Follow-up quick-set | With a patient checked in, tap one of the follow-up chips (1 wk / 2 wks / 1 mo / 3 mos). | A task "Follow up with {name}" is created with that due date, visible in Tasks. | 🔲 Needs manual test |
| 6.6 | Next / previous patient | Tap the chevron buttons either side of the recap control. | Advances/retreats through the active queue for that doctor. | 🔲 Needs manual test |

### 7. Patients

**Path**: `/patients`, `/patients/[id]`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 7.1 | Browse / search patients | Open Patients, type a name or phone fragment into search. | List (mobile) or table (desktop) filters live; shows visit count and last-visit date per patient. | 🔲 Needs manual test |
| 7.2 | Open a patient file | Tap a patient row. | Header with call/message/book actions, last-visit summary card with AI note, full visit timeline, phone/email/tags/review-status grid. | 🔲 Needs manual test |
| 7.3 | Message a patient from their file | Tap the message icon on a patient's header. | Finds or creates a WhatsApp thread for that patient and navigates straight into it (Consults thread view). | ✅ Verified live — `findOrCreateThread` + real WhatsApp send was proven this session. |
| 7.4 | Book from a patient file | Tap **Book** on a patient's header. | Booking sheet opens pre-filled with that patient's phone. | 🔲 Needs manual test (same underlying booking call as 4.3, already proven). |
| 7.5 | Attach a scanned prescription | On a visit without a digital Rx, tap **Attach Rx**, choose/take a photo. | Uploads and marks that visit "Rx on file." | 🔲 Needs manual test |
| 7.6 | Generate a digital prescription | With "Digital prescriptions" on (Profile → Practice), on a patient with at least one visit, tap **Prescription**, type the Rx text, tap **Generate & send**. | A clinic-letterhead PDF is generated, uploaded, attached to the latest visit, and a WhatsApp message with the PDF link is sent to the patient — toast "Prescription PDF sent." | ✅ Verified live — the PDF generation + upload + WhatsApp send chain was proven this session (also reachable directly from Consults' "Prescription" quick action and the `?rx=1` deep link). |
| 7.7 | Show more visit history | On a patient with 2+ visits and "Simple" view mode, tap "Show N earlier visits." | Full visit list expands. | 🔲 Needs manual test |

### 8. Team

**Path**: `/team`, role: doctor/owner only for inviting

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 8.1 | Send a real invite | As a doctor/owner, tap the **+** (or the "Invite someone into the rhythm" banner), fill name/phone/role, tap **Send invite**. | A WhatsApp message with the invite link is sent to that phone number; toast "Invite sent to {name} on WhatsApp." | ✅ Verified live — `POST /api/v1/team/invites` real WhatsApp send confirmed this session. |
| 8.2 | Team roster | View the Team list. | Doctors and receptionists both listed with online/offline status and a status label ("N in flow" / "Off now" for doctors, "On shift"/"Off shift" for receptionists). | 🔲 Needs manual test |
| 8.3 | Receptionist can't invite | Log in as receptionist, view Team. | The invite **+** button and banner are hidden entirely (role check is `role === "doctor"` — this also hides it from a genuine owner who was invited *as* receptionist, which shouldn't normally happen but is worth being aware of). | 🔲 Needs manual test |

### 9. Automations (owner-only)

**Path**: `/automations`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 9.1 | Toggle channels | Turn WhatsApp / SMS on or off, tap **Save changes**. | Workflows below can only use enabled channels; save succeeds (owner) or fails with the 403 toast (non-owner doctor, see 3.3). | ✅ Verified live (data layer) — `Clinic.settings.communication.channelsEnabled` was read/written repeatedly and directly drives real send behavior this session; the save UI itself wasn't clicked. |
| 9.2 | Edit the voice greeting | Change the text in "Voice greeting," save. | This exact text is what plays (via cached ElevenLabs audio) when a call to the clinic's number goes unanswered. | ✅ Verified live — greeting caching + playback confirmed via real calls this session. |
| 9.3 | Add a new workflow | Tap **Add** under Workflows, pick a trigger (Booking confirmed / Rescheduled / Cancelled / Reminder / Missed call follow-up / etc.), a channel, write a template using `{{patientName}}`, `{{doctorName}}`, `{{clinicName}}`, `{{apptTime}}`, `{{bookingUrl}}`, set enabled, save. | New workflow appears in the list; the next matching event (a real booking, reschedule, etc.) sends this exact message. | ✅ Verified live — this exact mechanism (including a real bug found and fixed: the `missed_call_followup` workflow silently no-ops without one configured, and the booking-confirmation template needed `{{bookingUrl}}` added manually for the link to actually appear) was exercised directly on the demo clinic's real data this session. **Recommend re-testing this specifically since it's the one area with the most recently-found gaps.** |
| 9.4 | Edit / disable / delete a workflow | Tap an existing workflow row to edit it, or the trash icon to remove it. | Edits apply to the next matching event; disabled workflows show dimmed and are skipped; deleted ones are gone from the list. | 🔲 Needs manual test |
| 9.5 | Phone routing | Under "Phone routing," add a real clinic number, verify it appears with active/inactive toggle and can be removed. | This maps a real clinic phone number's missed/forwarded calls to the shared ScheduRx number for a specific doctor (or clinic-wide). | 🔲 Needs manual test |

### 10. Analytics

**Path**: `/analytics`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 10.1 | Summary view | Open Analytics as a doctor. | Revenue hero card (last 30 days), one AI-generated "practice pulse" insight, three quick stats (appointments / no-show% / return%). | 🔲 Needs manual test — `usePracticePulse()` wiring was done this session and builds cleanly; not clicked through live. |
| 10.2 | Full charts | Tap "Full analytics." | Bookings-by-day bar chart, revenue area chart, today's status breakdown, per-doctor slot utilization. | 🔲 Needs manual test |
| 10.3 | Receptionist gate | Log in as receptionist with "Reception analytics" **off** (default). | "Analytics stays with the doctor" lock screen instead of the dashboard. | 🔲 Needs manual test |
| 10.4 | Receptionist gate opened | Owner turns "Reception analytics" on (Profile → Practice). Log in as receptionist. | Full analytics dashboard now visible to receptionist too, and the nav item itself becomes visible (this is the `doctorish`/`receptionAnalytics` interaction noted in the role legend). | 🔲 Needs manual test |

### 11. Billing

**Path**: `/billing`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 11.1 | Billing off (default) | With "Billing & invoices" off (Profile → Practice), open Billing. | "Billing is switched off" empty state, with different copy for doctor ("Turn it on from Profile → Practice") vs receptionist ("The doctor hasn't enabled billing yet"). | 🔲 Needs manual test |
| 11.2 | Billing on — overview | Turn billing on, revisit Billing. | Collected-this-month hero, due/collected progress bar, list of recent invoices. | 🔲 Needs manual test |
| 11.3 | Send an invoice | Tap **Send** next to an invoice. | Finds/creates a thread with that patient and sends a WhatsApp message confirming payment received (if paid) or a pending-payment nudge (if due). | ✅ Verified live (data layer) — same `findOrCreateThread` + `reply` mechanism proven elsewhere this session; not clicked through this exact button. |

### 12. Tasks

**Path**: `/tasks`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 12.1 | Quick-add a task | Type a task, tap the checkmark (or press Enter) with no due time set. | Appears under "Next," toast "Task added." | 🔲 Needs manual test |
| 12.2 | Add with a due time | Type a task, tap a quick chip (In 1 hour / Tonight 8pm / Tomorrow 9am) or "Custom time" with a specific date+time, submit. | Task shows its due label; you'll get nudged around that time (reminder mechanism). | 🔲 Needs manual test |
| 12.3 | Also block the calendar | With a due time set, toggle "Also block my calendar," pick a duration, submit. | Both the task **and** a real calendar block are created for that window. | 🔲 Needs manual test — the underlying `blockTime` call is the same one proven in Scenario 4.6/9. |
| 12.4 | Complete / reopen / delete | Tap the circle to complete a task, the checkmark to reopen a completed one, the trash icon to delete. | Moves between "Next" and "Completed" sections correctly; delete removes it entirely. | 🔲 Needs manual test |
| 12.5 | AI-added tasks are marked | A task created by Ask ScheduRx (Scenario 16) or the WhatsApp patient agent's escalation. | Shows a small sparkle icon next to it, distinguishing it from manually-added tasks. | 🔲 Needs manual test |

### 13. AI activity (History)

**Path**: `/history`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 13.1 | Calls tab | Open AI activity → Calls. | Every call the voice IVR handled, with outcome label (booked / rescheduled / visit confirmed / missed call recovered / query answered), duration, language, and an AI-generated summary. | 🔲 Needs manual test — call logging itself (`CallLog` writes) was exercised live this session via real test calls; the list view wasn't opened. |
| 13.2 | WhatsApp tab | Switch to WhatsApp. | Every automated WhatsApp send (booking confirmation, reminder, follow-up, review request, prescription) with a preview and relative time. | 🔲 Needs manual test |

### 14. Notifications

**Path**: `/notifications`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 14.1 | Receive & view | Trigger something that creates a notification (e.g. a critical-triage message arrives, per Scenario 17). | Appears grouped under Today/Yesterday/Earlier with an icon matching its kind (critical/reminder/booking/review/waitlist/system). | 🔲 Needs manual test |
| 14.2 | Mark read / remove | Tap the check on an unread item; tap the trash on any item; use "mark all read" (top right, only shown when there's something unread). | Read state updates immediately; removed items disappear. | 🔲 Needs manual test |

### 15. Profile

**Path**: `/profile`

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 15.1 | Switch theme / light-dark mode | Pick a different theme card; switch Light/Auto/Dark. | Applies immediately across the app. | 🔲 Needs manual test |
| 15.2 | View mode (Simple/Advanced) | Toggle "View" under Experience. | Affects how much detail patient files / analytics show by default (e.g. visit-history truncation on Scenario 7.7). | 🔲 Needs manual test |
| 15.3 | Consultation capture mode | Toggle Ambient/Recap under Clinical (doctor only). | Changes which control appears on Now Serving (Scenarios 6.3/6.4). | 🔲 Needs manual test |
| 15.4 | Practice toggles | Toggle Digital prescriptions / Billing / Reception analytics (doctor only). | Each immediately gates the corresponding feature elsewhere (7.6, 11, 10.3/10.4). Non-owner doctors get the 403 toast per Scenario 3.3. | 🔲 Needs manual test |
| 15.5 | Fee / slot length / registration no. | Edit fee or slot minutes, tap **Save changes**. | Updates the doctor's real fee/slot-duration used by every booking flow (4.3, form-agent booking). | 🔲 Needs manual test |
| 15.6 | Enable push notifications | Tap "Enable critical-case alerts." | Browser permission prompt, then a real push subscription is registered; a confirmation notification fires immediately. | ✅ Verified live (data layer) — `subscribeToPush` + `listSubscriptionsForStaff/Clinic` backend proven this session with real VAPID delivery; the button itself wasn't clicked. |
| 15.7 | Install as app | Tap "Install ScheduRx" / "Add to home screen." | Native install prompt (if the browser supports it) or a toast pointing to the browser menu otherwise. | 🔲 Needs manual test |
| 15.8 | Log out | Tap the logout icon in the header. | Session clears, redirected to `/`. | 🔲 Needs manual test (same as 3.4). |

### 16. Ask ScheduRx (AI assistant)

**Where**: floating control available app-wide (opens a sheet)

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 16.1 | Ask by typing | Open the sheet, type a request like "Block my next 3 hours," send. | Streams a reply; for tool-using requests, shows a progress label ("Blocking your calendar…" etc.) while the tool runs, then a plain-text confirmation. A manual replay (speaker) icon appears on the finished reply. | 🔲 Needs manual test — the tool-calling itself (`block_time`, `find_next_free_slot`, `find_patient_history`, `add_task`) is heavily backend-tested and was exercised live via the equivalent WhatsApp-agent tools this session; the staff-facing chat UI wasn't clicked through directly. |
| 16.2 | Ask by voice (hold-to-speak) | Hold the large warm control (or the mic button in the input bar) while speaking, release. | Live transcription fills the input as you speak (browser's native speech recognition); on release, the question sends automatically and the reply **auto-plays aloud** once it finishes streaming. | ✅ Verified live (voice output half) — ElevenLabs `POST /api/v1/assistant/speak` and the auto-play-on-voice-question logic were built and tested with the real API key this session. The native browser speech-to-text half (hold-to-speak) hasn't been exercised — it depends on browser support, test in Chrome. |
| 16.3 | Replay a reply | Tap the speaker icon on any finished assistant bubble. | Plays that reply aloud again (or stops it if already playing). | ✅ Verified live — same mechanism as 16.2. |
| 16.4 | Quick actions | With no conversation yet, tap one of the 4 suggested actions ("Block my next 3 hours," "When am I free next?," "Find a patient's last visit," "Add a task"). | Sends that exact phrase as the first message. | 🔲 Needs manual test |
| 16.5 | Voice not supported | Open in a browser without Web Speech API support (or deny mic permission) and try hold-to-speak. | Toast: "Voice dictation isn't supported in this browser" (or a mic-permission error) — no crash, falls back to typing. | 🔲 Needs manual test |

---

## Part 2 — Patient-facing channels

### 17. WhatsApp inbound AI agent

**Where**: real WhatsApp number `+1 978 906 9398`, no dashboard involved

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 17.1 | First contact | From a phone with an existing appointment on file, send "Hi" to the clinic's WhatsApp number. | AI replies conversationally within a few seconds, scoped strictly to that phone number's own patient/appointment data (never asks for or accepts a patient ID from the conversation). | ✅ Verified live this session. |
| 17.2 | Ask about upcoming appointments | Ask "What appointments do I have?" | Replies with real appointment(s) in the caller's own local time, correctly labelled (not raw UTC). | ✅ Verified live — this was the specific bug (UTC mislabeling) found and fixed this session. |
| 17.3 | Reschedule via free text | Ask to move an appointment to a specific new day/time. | AI calls the reschedule tool with the caller's own appointment, confirms the new time back in plain language, and it's reflected on the real calendar / dashboard. | ✅ Verified live — including two real bugs found and fixed here (missing `doctorId`, and a UTC double-conversion bug from a bare time being echoed back). |
| 17.4 | Cancel via free text | Ask to cancel an appointment. | AI cancels the caller's own appointment and confirms. **Known risk**: a real instance was observed this session where the agent cancelled instead of rescheduling when asked to reschedule, with a self-contradictory confirmation message. There is currently no confirm-before-execute safeguard on this — see Known Gaps. Test this scenario carefully and read the AI's confirmation message before trusting the outcome. | 🔴 Known issue — functional but no safety confirmation step; verify carefully each time. |
| 17.5 | Escalate to staff | Ask something outside what the agent can resolve (e.g. "I need to talk to the doctor about my results"). | Agent replies that it's flagging this for staff, and a corresponding entry appears in the dashboard's Consults inbox (escalated flag) / Notifications. | ✅ Verified live. |
| 17.6 | Someone else's phone number | Attempt to reference or claim another patient's appointment from a phone number that isn't on file for it. | Agent never accepts a patient identifier from the conversation itself — it can only ever act on data tied to the verified calling phone number. Should simply not find/show anything belonging to someone else. | 🔲 Needs manual test — the *mechanism* (tools only ever receive server-verified `patientId`/`clinicId`, never model output) is a hard architectural guarantee proven via code review and automated ownership-enforcement tests, but hasn't been probed adversarially via a real conversation. |

### 18. Voice / IVR

**Where**: real number `+1 978 906 9398`, phone call

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 18.1 | Call and let it ring out | Call the clinic's number and don't get through to anyone. | Hear a natural-sounding (ElevenLabs) greeting — the exact text configured in Automations (Scenario 9.2) — not the default robotic Twilio voice, after the very first call (subsequent calls use a cached recording). | ✅ Verified live. |
| 18.2 | Missed-call WhatsApp follow-up | After the call in 18.1, wait for the call to fully end/hang up. | A WhatsApp message referencing the missed call arrives, using the `missed-call-wa` workflow template (Scenario 9.3). | ✅ Verified live — **and this exact scenario required two real fixes this session** (Twilio's status-callback URL wasn't configured on the number at all, and no `missed_call_followup` workflow existed) — worth re-testing once more after any future number/workflow changes since it has a history of silent no-ops. |

### 19. Patient booking form (schedurx-form-agent)

**Where**: `https://schedurx-form-agent.vercel.app`, separate deployment — see the repo-topology note if you're not sure this is a different codebase from the dashboard.

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 19.1 | Bare root URL | Visit `https://schedurx-form-agent.vercel.app/` directly (no clinic/phone in the path). | A plain "this page is only reachable from a booking link" message — **not** a pre-filled demo booking form. (This was a real bug fixed this session — the root page used to hard-redirect into a demo clinic's booking form.) | ✅ Verified live — fix built, built cleanly, pushed to production. |
| 19.2 | Open a real clinic booking link | Visit `https://schedurx-form-agent.vercel.app/{clinicId}/{phone}` for a real clinic/phone (e.g. from a clinic-shared link). | Loads that clinic's real doctor roster from the live backend (not a mock). If only one doctor, skips straight to the details step. | ✅ Verified live. |
| 19.3 | Full booking wizard | Pick a doctor (if prompted) → enter name/age/gender/booking-for → describe symptoms → pick a date and a real available time slot → review → confirm. | A real appointment is created on the real calendar; confirmation screen shows appointment details with an "Add to Google Calendar" link. A WhatsApp confirmation arrives at the phone number used. | ✅ Verified live, full loop, including the real WhatsApp confirmation with a working manage-appointment link. |
| 19.4 | No time selected | Try to continue from the time-picker step without selecting a specific slot. | **Continue is now required to have a slot selected** — the old "skip, clinic will confirm" option was removed this session, since the backend always needs a real calendar slot (same as every other booking path). If you need a "call to confirm" style flow, that's a product decision to revisit, not currently supported. | ✅ Verified live (build + real booking flow confirmed slot-required). |
| 19.5 | Manage an existing booking | Open the manage link from a real confirmation WhatsApp message (`.../{clinicId}/{appointmentId}`). | Shows the appointment's real current status/time/doctor with **Reschedule** and **Cancel appointment** actions, both hitting the same real backend calls Calendar uses (4.4/4.5). | ✅ Verified live, including a real reschedule performed through this exact page and reflected via the API. |
| 19.6 | Wrong/unknown link segment | Open `.../{clinicId}/{some-random-string}` that matches neither a real appointment nor looks like a phone number. | Falls back to treating it as a phone number and shows the booking wizard for that "phone" — worth confirming this degrades sensibly rather than confusingly (e.g. what a doctor sees if a patient mistypes a shared link). | 🔲 Needs manual test |

### 20. Full cross-system loop

This is the single most important thing to run end-to-end before handover — it touches all three repos and Twilio.

| # | Scenario | Steps | Expected outcome | Status |
|---|---|---|---|---|
| 20.1 | Book → confirm → converse → verify | 1) Book a real appointment through the live form-agent site (19.3) using a phone you control on WhatsApp. 2) Confirm the WhatsApp confirmation arrives with a working manage link. 3) Reply with a free-text question or reschedule request on WhatsApp (17). 4) Confirm the AI agent handles it correctly. 5) Open the dashboard's Calendar as staff and confirm the appointment (and any change from step 3) is reflected. | Every step succeeds and the dashboard view matches reality — no step is silently skipped or shows stale data. | ✅ Verified live, this exact sequence, multiple times this session (most recently: booked via the real Vercel deployment → real WhatsApp confirmation with working link → rescheduled via that link → new WhatsApp notice with the updated time). |

---

## Known gaps (intentional, not yet fixed)

Honest list of what's known-incomplete, so nothing here is a surprise at handover:

1. **WhatsApp AI agent has no confirm-before-execute safeguard.** A real instance this session showed it cancel an appointment when asked to reschedule, with a self-contradictory confirmation message. It works correctly in the large majority of cases tested, but there's no "are you sure?" gate before a reschedule/cancel actually executes. Worth deciding whether to add one before relying on it unsupervised.
2. **`reminder-24h-wa` and `cancel-wa` templates don't include `{{bookingUrl}}`** (only `booking-conf-wa` and `reschedule-wa` were updated this session) — same one-line fix if you want the link everywhere.
3. **ESLint and TypeScript build checks are still disabled** in `next.config.mjs` (`ignoreDuringBuilds` / `ignoreBuildErrors`) — re-enabling needs an initial ESLint config setup first (never done) plus fixing whatever it then flags.
4. **Dead code not yet removed**: `src/lib/mock.ts`, `src/components/ui/rich-text-editor.tsx`, and the unused `@tiptap/*` dependencies.
5. **`schedurx-form-agent`'s standalone DigitalOcean nettu-scheduler deployment (`deploy/nettu/`) is now redundant** — the app is a thin client of the main backend now and doesn't need its own scheduler instance. Worth shutting down if still running, to avoid paying for/running two.
6. **Some scenarios above are marked "data layer verified" rather than "clicked through in a browser.”** These are lower-risk (the exact API call the button makes was already proven with real data) but haven't had an actual human operate the on-screen control. Worth a first pass through those specifically.
