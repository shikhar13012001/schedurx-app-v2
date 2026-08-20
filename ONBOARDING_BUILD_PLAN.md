# ScheduRx — Implement the Complete 7-Screen Clinic Onboarding Flow

You are working inside the **existing ScheduRx production application**.

ScheduRx is an India-first AI Clinic OS designed primarily for independent doctors, solo practitioners, small clinics, and polyclinics. The platform already has substantial functionality implemented, including appointment booking, calendars, doctor availability, time blocking, patient records, clinic/team workflows, AI-assisted patient communication, WhatsApp, voice calling, reminders/follow-ups, voice notes/clinical notes, website/booking experiences, and related clinic-management functionality.

The onboarding flow described below does **not** exist yet.

Your job is to implement it deeply into the existing application.

Do **not** create an isolated demo, standalone onboarding mockup, parallel database model, or throwaway set of components.

Before modifying code:

1. Inspect the existing repository structure.
2. Identify the actual frontend framework, backend framework, authentication stack, database/ORM, storage system, existing design system, state-management conventions, API conventions, billing implementation, calendar/availability implementation, time-blocking implementation, appointment configuration, clinic/team models, user/role models, feature flags, telephony infrastructure, WhatsApp infrastructure, and existing onboarding-related code if any.
3. Find the existing canonical models for:

   * users
   * clinics/workspaces/organizations
   * doctors
   * receptionists/staff
   * memberships/permissions
   * appointment settings
   * doctor availability
   * blocked calendar time
   * clinic operating hours
   * patient booking
   * payments/fees
   * subscriptions
   * feature entitlements
   * voice/telephony
   * WhatsApp
   * reminders/follow-ups
   * website/profile data
4. Reuse and extend those systems.
5. If my terminology below differs from terminology in the existing codebase, map my meaning onto the existing canonical models instead of creating duplicate concepts.
6. Make the minimum safe schema additions necessary.
7. Preserve backwards compatibility for existing clinics and existing users.

Do not merely give me a plan. **Implement the feature.**

After implementation, run the project's relevant linting, type checking, tests, build checks, migrations/schema validation, and any other appropriate verification available in the repository.

---

# 1. PRODUCT AND DESIGN INTENT

The onboarding should make it possible for a salesperson, founder, onboarding representative, or doctor to send the ScheduRx platform to a clinic and have the clinic become operational without a ScheduRx employee manually configuring every field.

The guiding experience is:

**Google sign-in → identify clinic structure → enter personal/provider information → configure clinic → choose product plan → optionally configure call forwarding → invite team → enter ScheduRx.**

This should feel substantially easier than configuring traditional clinic-management software.

The onboarding should use progressive disclosure so that a doctor does not see an intimidatingly long form.

## Visual direction

Use the application's existing visual system, but make this flow feel like premium ScheduRx:

* light-first
* clean
* futuristic but professional
* generous white space
* restrained glass/glassmorphism only where it improves hierarchy
* subtle borders
* subtle shadows
* polished animations
* rounded controls
* excellent typography
* no generic green hospital aesthetic
* no cheesy healthcare illustrations
* no stock-doctor imagery
* no childish cyberpunk visuals
* no excessive gradients
* no unreadable transparent cards

The experience must work exceptionally well on both desktop and mobile.

On desktop, use a comfortably constrained central onboarding container rather than stretching form fields across the entire viewport.

On mobile, make controls large enough to operate with one hand.

Use a persistent progress indicator after authentication:

**1. Account → 2. Practice → 3. You → 4. Clinic → 5. Plan → 6. Calls → 7. Team**

Do not make the progress indicator visually dominant.

---

# 2. CORE ARCHITECTURE REQUIREMENT

Model onboarding as a resumable state machine.

A user should be able to:

* complete a screen
* refresh
* close the browser
* log back in later
* continue where they stopped

Do not lose previously entered information.

Use server-side persistence rather than relying solely on browser state.

Recommended conceptual onboarding state:

* `not_started`
* `account_authenticated`
* `practice_type_selected`
* `personal_profile_completed`
* `clinic_profile_completed`
* `plan_selected`
* `call_forwarding_reviewed`
* `team_invites_reviewed`
* `completed`

Adapt these to existing models/conventions rather than blindly creating this exact enum if another pattern already exists.

Maintain:

* current step
* completed steps
* onboarding version
* onboarding started timestamp
* onboarding completed timestamp
* skipped optional sections
* selected plan/add-ons if relevant

All save operations should be idempotent.

Use autosave where practical.

The main Continue button must show a saving/loading state and prevent accidental duplicate requests.

---

# 3. AUTHENTICATION — IMPORTANT

## Google only

For this onboarding version:

**DO NOT BUILD OTP AUTHENTICATION.**

There should be no OTP phone login screen.

The primary authentication CTA is:

**Continue with Google**

Use the application's existing Google OAuth implementation if it exists.

If Google auth is not currently implemented, integrate it in the same authentication architecture already used by the platform rather than introducing a second unrelated auth system.

From Google, preserve whatever verified identity data is legitimately available, especially:

* provider user ID / subject
* verified email
* display name
* profile/avatar URL if supplied

Do not assume Google will provide phone numbers or unrelated profile data.

---

# 4. SCREEN 1 — ACCOUNT / GOOGLE AUTHENTICATION

This is the initial centrally aligned authentication screen.

## UI structure

Show:

ScheduRx logo

Headline similar to:

**Set up your clinic with ScheduRx**

Subcopy:

**A few details and your clinic is ready to run.**

Primary large button:

**Continue with Google**

Then a subtle divider:

**or**

Then:

**Joining an existing clinic?**

Input:

**Enter invite code**

Button:

**Join clinic**

Also support users who arrive through a complete invitation URL.

Example conceptual routes:

`/join/<invite-token>`

or

`/signup?invite=<token>`

Use whatever routing convention fits the repository.

## Invite-code behavior

A short invite code may be entered before authentication.

Do not create a clinic membership solely from the entered code before authenticating the user.

Instead:

1. Validate that the code appears valid.
2. Store the pending invite context safely.
3. Ask the person to authenticate through Google.
4. After verified authentication, redeem/accept the invite server-side.
5. Associate the authenticated identity with the invited clinic.

If they arrived from an invitation link, visually acknowledge it:

**You've been invited to join [Clinic Name]**

If the invite has a predefined role, display it:

**Invited as Receptionist**

or

**Invited as Doctor**

Do not expose sensitive clinic data before successful authentication.

## Invalid invites

Handle:

* invalid invite
* expired invite
* revoked invite
* invite already fully consumed
* invite for a clinic that no longer exists
* user already in clinic
* duplicate acceptance

Give clear error messages and a way to continue with a normal ScheduRx signup.

## Existing ScheduRx user

If the Google account belongs to a user with completed onboarding:

* do not restart onboarding
* route to the correct workspace/app

If their onboarding is incomplete:

* resume at the correct step

If an existing user is accepting an invitation to another workspace, follow the app's existing multi-workspace rules.

---

# 5. SCREEN 2 — CHOOSE PRACTICE STRUCTURE

For a new workspace, ask:

## “How is your practice set up?”

Two large selectable cards.

### Option A — Solo Practice

Display copy along the lines of:

**One doctor, one clinic team**

Description:

For a single doctor operating independently, with one or more receptionists or staff members.

Internal conceptual value:

`solo`

Rules:

* maximum active doctor membership = 1
* may have multiple receptionists/staff
* workspace creator can technically be either the doctor or receptionist/admin
* do not confuse clinical role with administrative permissions

### Option B — Polyclinic / Team Practice

Display copy:

**Multiple doctors, one clinic team**

Description:

For clinics where multiple doctors and receptionists work together.

Internal conceptual value:

`polyclinic`

Rules:

* multiple doctors
* multiple receptionists/staff
* each doctor can have individual availability/profile data
* clinic-level configuration remains shared
* doctor-specific configuration can override relevant defaults where the application supports this

## Permissions vs professional role

Do not model “doctor/receptionist” as synonymous with “admin/non-admin”.

These are separate concepts.

For example:

* clinic owner may be a receptionist
* clinic owner may be a doctor
* invited doctor may not be an administrator
* receptionist may later be promoted to administrator

Reuse the application's permissions model.

The initial creator should generally become workspace owner/admin unless existing application rules say otherwise.

## Invite mode

If the user came through an invitation:

Do not allow them to redefine the clinic from Solo to Polyclinic or vice versa.

Inherit the practice structure from the workspace.

Prefer skipping this screen completely for invited users.

If the router requires maintaining the seven-step visual structure, render a brief read-only confirmation rather than an editable form.

---

# 6. SCREEN 3 — PERSONAL PROFILE

This screen configures the person currently onboarding.

It must support both:

* Doctor
* Receptionist

The top of the screen should remain compact.

Use collapsible sections/accordions for advanced information.

---

## 6.1 Basic identity

### Full Name

Prefill from Google.

Editable.

Conceptual type:

`string`

Validation:

* trim whitespace
* reasonable maximum length, e.g. 100 characters
* support Indian and international Unicode names
* do not artificially restrict names to English characters

### Email

Prefill from verified Google OAuth email.

Read-only.

Do not allow editing from this onboarding screen.

If the system permits changing account email elsewhere, that should remain a separate account-security workflow.

### Role

Segmented selector/cards:

* Doctor
* Receptionist

Conceptual values:

`doctor`
`receptionist`

Changing role should dynamically change the fields displayed below.

If role changes before completion, preserve compatible common fields and safely handle role-specific draft information.

---

# 7. DOCTOR-ONLY PROFILE INFORMATION

Display this entire professional section only when:

`role === doctor`

Everything here can remain optional during this initial onboarding unless the existing system has a legitimate hard requirement.

Do not block launch because a doctor has not yet entered an award, biography, degree proof, etc.

The objective is rapid initial setup.

---

## 7.1 Doctor personal phone

Label:

**Personal phone number**

Use an India-specific phone control.

Fixed visual prefix:

`+91`

Only allow exactly 10 digits after the prefix.

Prefer validation compatible with Indian mobile numbers:

`^[6-9][0-9]{9}$`

Store normalized E.164 form:

`+91XXXXXXXXXX`

Do not store the formatted display value as the canonical value.

---

## 7.2 Preferred UPI ID

Label:

**Preferred UPI ID**

Helper text:

**Used for eligible payouts or clinic payment workflows. You can add this later.**

Optional.

Examples:

`doctor@okaxis`
`9876543210@paytm`

Do not show a doctor's UPI ID publicly on their generated website unless the existing product explicitly has a separate setting authorizing that.

Do not over-restrict legitimate UPI handles with an excessively narrow regex.

Normalize whitespace and case only where appropriate.

---

# 8. DOCTOR PROFESSIONAL DETAILS ACCORDION

Title:

**Professional profile**

Initially collapsed or partially collapsed.

---

## 8.1 Years of experience

Input type:

integer

Recommended range:

0–80

Do not allow negative numbers or decimals.

---

## 8.2 Specialization

Searchable multi-select/tag control.

Examples:

* General Physician
* Dermatologist
* Cardiologist
* Pediatrician
* Gynecologist
* Psychiatrist
* Dentist
* Orthopedic Surgeon
* ENT Specialist
* Ophthalmologist
* Physiotherapist
* Dietitian/Nutritionist
* Psychologist
* Other

Do not hard-code this tiny example list as the complete medical taxonomy if the app already has specialization data.

Reuse existing specialization/service taxonomy if available.

Allow custom entry if the product currently supports it.

---

## 8.3 One-line bio

Label:

**Profile headline**

Example:

**Consultant Dermatologist with a special interest in clinical and aesthetic dermatology.**

Suggested maximum:

160–200 characters.

Show a character counter.

---

## 8.4 About the doctor

Multiline optional biography.

Suggested maximum:

2,000–3,000 characters.

This should feed the doctor website/profile system if one already exists.

---

# 9. DOCTOR PHOTOS

Section:

**Photos**

Doctor can upload between zero and five photos.

Nothing is compulsory.

Accept sensible web formats:

* JPEG
* PNG
* WebP

Use the existing media/storage infrastructure.

Provide:

* upload
* preview
* reorder
* delete
* replace

Allow one image to be selected as:

**Primary profile photo**

If Google supplied an avatar, it may be shown as a convenient starting option, but do not automatically publish a low-resolution Google avatar as the doctor's public medical profile photo without user choice.

Apply existing image compression/resizing pipelines if present.

Do not upload duplicate files on every autosave.

---

# 10. ADDITIONAL STRUCTURED DOCTOR PROFILE DATA

The purpose of collecting this information is that ScheduRx can later create a much richer doctor website/profile without asking for these details again.

Keep these inside optional collapsed areas so screen 3 remains visually manageable.

---

## 10.1 Qualifications / Education

Repeatable group.

Fields:

* Degree / Qualification
* Institution
* Completion year
* Optional specialization/subject

Example:

MBBS — AIIMS New Delhi — 2014

Allow:

**+ Add qualification**

---

## 10.2 Medical registration

Repeatable if necessary.

Fields:

* Registration number
* Medical council
* Registration year
* Optional proof document/image

Do not make verification mandatory for completion right now unless ScheduRx already has compliance rules requiring it.

Keep this information appropriately protected.

---

## 10.3 Current and previous hospital affiliations

Repeatable.

Fields:

* Hospital / Organization
* Role / Designation
* Start year/date
* End year/date
* “Currently working here” toggle

Examples:

Consultant Cardiologist — Apollo Hospitals

Visiting Consultant — XYZ Hospital

This should later be usable on the doctor website/profile.

---

## 10.4 Services / Procedures

Tag or repeatable field.

Examples should be specialization-dependent where existing taxonomy permits.

Do not make it mandatory.

---

## 10.5 Awards & Recognition

Repeatable.

Fields:

* Award name
* Awarding organization, optional
* Year
* Short description, optional

---

## 10.6 Professional memberships

Repeatable.

Fields:

* Association / Society name
* Membership number, optional
* Since year, optional

---

## 10.7 Languages spoken

Multi-select.

Seed with common options appropriate to India, such as:

* English
* Hindi
* Bengali
* Marathi
* Telugu
* Tamil
* Gujarati
* Urdu
* Kannada
* Malayalam
* Odia
* Punjabi
* Assamese

Do not limit the user to this list.

This field can later help both:

* website presentation
* ScheduRx AI language configuration

Do not automatically activate unsupported AI languages solely because a doctor selected them.

---

## 10.8 Consultation modes

Capture preference for:

* In-clinic
* Online/video
* Home visit, if relevant
* Other

Important:

This captures doctor preference only.

It must not bypass subscription entitlements.

If the selected plan later does not include online consultations, preserve the preference but keep the actual product feature disabled until entitled.

---

# 11. FUTURE FLEXIBILITY FIELDS

I specifically want four generic fields preserved for future use.

Create an optional collapsed section:

**Additional profile information**

Inputs:

* Additional Information 1
* Additional Information 2
* Additional Information 3
* Additional Information 4

Use multiline textareas.

Do not rename these four fields into a narrowly defined purpose yet.

If the existing database supports dynamic custom profile fields, use that architecture rather than adding four awkward top-level columns.

The UI labels can remain generic for now.

---

# 12. PERSONAL WORKING HOURS

This part is important.

Show it for **both doctors and receptionists**, because their personal shifts may differ from clinic operating hours.

Title:

**Your working hours**

Helper:

**Tell ScheduRx when you're normally available. You can change this anytime.**

This must be conceptually separate from clinic opening hours.

Reuse the application's existing availability and time-blocking architecture.

Do not create a second incompatible calendar system.

---

## 12.1 Day selector

Display seven compact rounded toggle buttons:

M
T
W
T
F
S
S

or abbreviated day names if there is enough width.

The underlying mapping must remain unambiguous:

* Monday
* Tuesday
* Wednesday
* Thursday
* Friday
* Saturday
* Sunday

Selected days visually highlight.

Unselected days disappear from the detailed schedule list beneath.

Example:

If the user selects:

Monday
Tuesday
Friday
Saturday
Sunday

Then only those five schedule rows should display.

---

## 12.2 Per-day hours

Each selected day gets:

**Start time → End time**

Use a polished time picker/dropdown.

Use the application's standard time granularity if already defined.

Otherwise support at minimum 15-minute increments.

Example:

Monday
9:00 AM → 5:30 PM

Support a convenient control:

**Copy to selected days**

or:

**Apply Monday's hours to all working days**

This will dramatically reduce setup friction.

Store canonical time values independently of the display's 12-hour formatting.

Default timezone:

`Asia/Kolkata`

Use the existing timezone architecture if one exists.

---

# 13. BREAKS / BLOCKED TIME

Below the personal schedule:

### Lunch Break

Optional time range.

Example:

1:00 PM → 2:00 PM

Buttons beneath:

**+ Add Snack Break**

**+ Add Dinner Break**

Also allow:

**+ Add Another Break**

if the existing blocked-time system supports custom labels.

A break should conceptually be represented as blocked/unavailable time.

Important architectural rule:

**Reuse ScheduRx's existing calendar/time-blocking mechanism.**

Do not make a disconnected “onboarding breaks” table that appointment booking does not understand.

If the existing time-blocking model has a field such as `type`, `source`, `reason`, etc., map onboarding blocks into it, for example:

* source: onboarding
* type: recurring_break
* label: Lunch

Adapt terminology to actual schema.

Break validation:

* must occur inside relevant working interval
* start must be before end
* overlapping breaks should be rejected or merged intentionally
* duplicate breaks should be prevented

If the application already supports recurring weekly blocks, use it.

---

# 14. SCREEN 4 — CLINIC INFORMATION

This is organization/clinic-level configuration.

The reception number MUST be here.

Do **not** collect the reception number on Screen 3.

The personal doctor's number and the clinic reception number are separate concepts.

Start the screen with core settings and put public-profile/location extras in expandable sections.

---

# 15. RECEPTION PHONE NUMBER

First field:

**Clinic / Reception Number**

India-only.

UI prefix permanently displays:

`+91`

Allow exactly 10 user-entered digits.

Recommended Indian mobile validation:

`^[6-9][0-9]{9}$`

Canonical storage:

`+91XXXXXXXXXX`

If the existing telephony system supports landlines and clinic landlines are legitimate inputs, respect its existing validation. Otherwise follow the requested 10-digit mobile constraint for this onboarding version.

This number should integrate with the existing telephony/missed-call/call-forwarding setup wherever relevant.

---

# 16. CLINIC IDENTITY

Capture:

### Clinic name

Example:

**Gupta Heart Clinic**

### Clinic email

Optional.

Do not confuse with the authenticated user's Google email.

### Clinic logo

Optional.

Use existing media infrastructure.

### Short clinic description

Optional.

Useful for the generated website.

---

# 17. CLINIC ADDRESS

Collect structured address information because it is required for an actually usable patient-facing clinic profile.

Fields:

* Address line 1
* Address line 2, optional
* Locality
* City
* State
* PIN code
* Landmark, optional
* Google Maps link, optional

PIN:

6 digits.

If the application already has a places/maps integration, reuse it.

Do not introduce a new paid maps dependency solely for this onboarding flow unless the repository already expects one.

If coordinates are already part of the clinic schema, populate them through the existing map/location flow where possible.

---

# 18. APPOINTMENT SLOT LENGTH

Label:

**Default appointment duration**

Preset options:

* 5 min
* 10 min
* 15 min
* 20 min
* 30 min
* 45 min
* 60 min
* 90 min
* 120 min
* Custom

The most visually prominent presets can be:

10
15
30
60

If Custom:

Display integer duration input.

Recommended bounds:

5–180 minutes.

Ensure the selected value actually feeds the existing appointment-slot generation/scheduling system.

For polyclinics, treat this as the **clinic default**.

Individual doctors may later override it if ScheduRx already supports provider-specific slot durations.

---

# 19. CONSULTATION FEE

Label:

**General consultation fee**

Prefix:

`₹`

Use INR.

Store monetary values safely using the existing monetary convention, ideally minor units/paise where the backend already does that.

Do not use floating-point currency calculations.

Accept zero if free consultation is valid in the existing platform.

Apply a reasonable server-side maximum rather than an arbitrary tiny limit.

This fee should feed the existing patient booking/website system.

---

# 20. TOKEN MONEY

Question:

**Collect an advance amount to confirm appointments?**

Toggle:

No / Yes

Default:

No

If No:

Do not show the amount field.

If Yes:

Animate open:

**Token amount**

Currency:

₹

Validate:

* amount > 0
* amount should ordinarily not exceed the consultation fee
* if consultation fee is empty or zero, handle gracefully
* store in the same monetary convention as fees

Do not automatically implement a new payment gateway if one does not exist.

Connect this configuration to the existing payment/booking infrastructure.

If the actual payment pipeline is not yet available, save the setting safely without creating fake payment success logic.

---

# 21. CLINIC WORKING HOURS

This must be separate from Screen 3 personal working hours.

A clinic can be operational for longer than one doctor or receptionist works.

For example:

Clinic hours: 8 AM–10 PM

Doctor A: 10 AM–2 PM

Doctor B: 4 PM–8 PM

Receptionist A: 8 AM–4 PM

Receptionist B: 4 PM–10 PM

Reuse the same high-quality weekly schedule component from Screen 3 rather than creating a second implementation.

Persist this as clinic operating hours, not user availability.

If a doctor enters personal hours that fall outside clinic hours:

* do not silently destroy their data
* display a warning
* explain the mismatch
* allow correction

Where appropriate, booking availability should effectively be constrained by both:

**clinic open + doctor available + not blocked + slot available + applicable booking rules**

Use the existing scheduler's actual logic.

---

# 22. OPTIONAL ADVANCED CLINIC DETAILS

Keep these collapsed.

Useful fields include:

### Accepted payment methods

* Cash
* UPI
* Card
* Other

### Clinic facilities

Optional tags such as:

* Parking
* Wheelchair access
* Pharmacy
* Waiting area
* Lift
* Other

### Public clinic photos

Optional.

### Booking rules

Only if compatible with existing features:

* minimum booking notice
* maximum advance booking period
* cancellation window
* walk-ins allowed

Do not overbuild these if they have nowhere legitimate to connect in the existing application.

---

# 23. SCREEN 5 — PLAN SELECTION

There should be exactly three main choices.

Use these user-facing names:

## 1. Clinic Core

Sub-label internally:

`basic`

## 2. Clinic Autopilot

Sub-label internally:

`premium`

## 3. Build Your Own

Sub-label internally:

`custom`

Store plan IDs/configuration centrally.

Do not scatter feature checks such as:

`if plan === "premium"`

through random components.

Use or extend the existing entitlement/feature-flag architecture.

---

# 24. PLAN 1 — CLINIC CORE

Recommended launch price:

**₹999/month**

Positioning:

**Everything you need to run appointments digitally.**

Include:

### Clinic website

* one standard ScheduRx website template
* no template selection
* doctor/clinic profile
* patient booking page
* appointment slot availability
* consultation information

### Scheduling

* appointment calendar
* appointment booking
* clinic availability
* doctor availability
* blocked times
* patient records
* team/reception access appropriate to the workspace

### WhatsApp

Structured WhatsApp appointment experience.

Think menu/button-driven rather than a fully conversational AI agent.

Examples:

* Book appointment
* View appointment
* Reschedule
* Cancel
* Clinic information

Do not enable unrestricted conversational AI WhatsApp on Core.

### Calling

**Missed-call safety net only.**

There is NO full AI receptionist answering inbound calls on this plan.

The intended behavior:

1. Patient calls the clinic.
2. Human receptionist/doctor gets the normal opportunity to answer.
3. If the call is not answered and ScheduRx's telephony infrastructure can detect/receive the conditional forward/missed-call event:
4. Trigger a WhatsApp/SMS message to the patient.
5. Message contains clinic identity and booking link.
6. Patient can self-book.

This is not a conversational AI phone agent.

### Clinical notes

**Voice notes only.**

A doctor can record/provide a voice note through the existing notes experience where supported.

Do not enable always-on/ambient consultation listening.

### Reminders and follow-ups

Use standard:

* WhatsApp text
* SMS/text where implemented

No conversational AI calling agent.

### Excluded from Core

Do not include:

* full inbound AI receptionist
* full outbound AI agent
* ambient listening
* conversational AI WhatsApp
* AI voice rescheduling conversations
* AI follow-up conversations

---

# 25. PLAN 2 — CLINIC AUTOPILOT

Recommended launch price:

**₹4,499/month**

Positioning:

**Your AI receptionist and clinic operations layer.**

Mark:

**Recommended**

This plan should represent the actual ScheduRx “clinic on autopilot” experience.

Include everything in Clinic Core plus:

### AI phone receptionist

* inbound AI calling agent
* appointment booking by voice
* appointment status
* rescheduling
* cancellation
* clinic FAQs where supported
* patient intent handling
* human escalation
* multilingual/Hinglish/regional-language capabilities supported by the existing AI stack

### AI outbound calling

Where existing product functionality supports it:

* appointment reminders
* follow-ups
* confirmations
* rescheduling
* relevant patient workflows

### AI WhatsApp

Full conversational WhatsApp agent.

Patients should be able to communicate naturally instead of navigating only a static menu.

Use supported languages.

The AI should connect to the same canonical booking/calendar data as the rest of ScheduRx.

Never let the WhatsApp agent create appointments in a separate shadow calendar.

### Ambient clinical listening

Enable the existing ambient listening/clinical-note functionality.

This should remain Premium-only.

### Advanced reminders/follow-ups

Allow conversational AI reminder/follow-up/rescheduling workflows.

### Online consultation

Include it if the functionality already exists.

### Website

Expose premium website capabilities already available in ScheduRx.

Do not invent a completely new website builder as part of this onboarding task.

### Analytics / automation

Enable relevant advanced workflow/analytics features already implemented and intended for the premium tier.

---

# 26. PLAN 3 — BUILD YOUR OWN

Base platform price:

**₹999/month**

Positioning:

**Start with the essentials. Add only the automation you need.**

The base should provide roughly the Clinic Core foundational clinic-management layer.

Then display selectable add-on modules.

Use checkboxes/toggles/cards with a running monthly subtotal.

Recommended initial module pricing:

### Online Consultations

`₹349/month`

### Smart IVR

`₹499/month`

This is traditional IVR/routing rather than a generative AI receptionist.

### AI Calling Agent

`₹599/month + usage credits`

Allows conversational AI phone handling.

### AI WhatsApp Agent

`₹699/month + applicable usage`

### Recorded Call Reminders

`₹299/month + usage credits`

This sends a predetermined/recorded reminder call rather than starting a conversational AI agent.

### AI Follow-up Agent

`₹399/month + usage credits`

### Ambient Clinical Listening

`₹1,499/month per doctor`

This is intentionally one of the more expensive modules because ambient listening is compute-heavy.

### Premium Website

If premium website capabilities exist separately:

`₹399/month`

Only expose add-ons that correspond to real or near-ready ScheduRx capabilities.

If the repository uses a remote pricing configuration/database table, define these there.

Do not hard-code prices in multiple React components.

---

# 27. TEAM / MULTI-DOCTOR BILLING

Respect the selected practice structure.

Avoid unexpectedly charging for receptionist logins unless the existing business model requires this.

Suggested initial logic:

### Solo Practice

Base plan includes:

* 1 doctor
* reasonable/unlimited receptionist accounts subject to abuse controls

### Polyclinic

Include a reasonable initial doctor allowance based on existing business rules.

If no rule exists yet, configure additional doctor seats as a centrally editable billing constant rather than permanently hardcoding assumptions throughout the app.

Suggested starting add-on:

**Additional doctor: ₹499/month**

Do not charge merely for inviting a receptionist unless product strategy already requires it.

---

# 28. SChedurx CREDITS / USAGE WALLET

High-cost AI activity should not be unlimited purely because the clinic subscribes to Premium.

Create or integrate with a **ScheduRx Credits** wallet.

If a wallet/usage-metering system already exists, use it.

Do not build a competing wallet.

The purpose of credits is that one common resource unit can pay for different variable-cost AI activities.

Credits are intentionally **not 1 credit = ₹1** because the platform has multiple cost categories.

However:

Do not use misleading UX.

The user should be able to understand approximate consumption.

---

# 29. RECOMMENDED CREDIT RECHARGE PACKS

Use centrally configurable values.

Recommended initial recharge packs:

### Starter

₹499 → **347 credits**

### Standard

₹999 → **743 credits**

### Growth

₹1,999 → **1,517 credits**

### Scale

₹4,999 → **3,941 credits**

Larger wallet purchases therefore have a modest volume advantage.

Do not display a simplistic “₹ value per credit” prominently.

Instead display the amount of usable credits and, where useful, an approximate usage example.

---

# 30. AI CALLING CREDIT ECONOMICS

Our current approximate underlying cost assumption for a true AI calling agent is:

**~₹5 per connected minute**

Average patient call assumption:

**~2–3 minutes**

Configure conversational AI voice usage initially as:

**4 credits per started 30 seconds of connected AI conversation**

Equivalent:

**8 credits per connected minute**

Bill by started 30-second interval.

Examples internally:

30 sec → 4 credits
60 sec → 8 credits
2 min → 16 credits
2.5 min → 20 credits
3 min → 24 credits

Do not bill ringing duration as AI conversation time.

Define clearly what counts as `connected_duration`.

Store:

* raw connected seconds
* usage category
* credits debited
* call identifier
* clinic/workspace
* timestamp
* provider/cost metadata if existing billing architecture allows

The conversion must be configurable server-side.

Do not trust the client to calculate or deduct credits.

---

# 31. OTHER RECOMMENDED CREDIT CONSUMPTION

Treat these as **initial configurable product values**, not immutable business logic.

### Conversational AI voice call

4 credits per started 30 connected seconds.

### Conversational AI reminder/follow-up call

Same AI voice rate unless the actual backend cost differs.

### Recorded reminder call

Recommended initial usage:

3 credits for a successfully connected reminder up to a reasonable short duration.

If actual telephony billing works differently, meter against the real infrastructure.

### AI WhatsApp reply

Recommended starting abstraction:

1 credit per AI-generated patient-facing response/turn.

Keep Meta/BSP messaging costs compatible with the actual billing provider.

Do not double-charge unknowingly if WhatsApp costs are already separately billed.

### Voice-note processing

Can use a small metered allowance/credit rate after included usage if the current product needs this.

### Ambient consultation processing

Premium entitlement determines whether feature is accessible.

High-volume usage may additionally consume credits if required by real unit economics.

Do not invent double billing unless the product already intends it.

---

# 32. PREMIUM INCLUDED CREDITS

Clinic Autopilot should include a useful monthly credit bundle.

Recommended:

**1,517 ScheduRx Credits/month**

Treat included monthly subscription credits separately from purchased wallet credits if expiration rules differ.

Recommended behavior:

* subscription credits reset monthly
* purchased/recharged credits persist according to the platform's final billing policy
* consume expiring included credits before persistent purchased credits

Do not implement arbitrary expiry of purchased money without explicit product/legal rules.

At the 8-credit/minute conversational voice rate, 1,517 credits corresponds to roughly 190 connected AI voice minutes if used entirely on calling.

This is roughly 75–76 average 2.5-minute calls.

Actual usage will be mixed across ScheduRx services.

---

# 33. CREDIT SAFETY

Before expensive AI actions:

* verify sufficient wallet balance
* follow existing grace/overage rules
* never allow race conditions to create negative balances accidentally
* make deductions idempotent
* tie deduction to actual usage event IDs
* protect against webhook retries causing double deductions

Provide low-balance status hooks for future notifications.

Do not make this onboarding task require a huge new billing platform if an existing one can be extended.

---

# 34. PLAN-SELECTION UX

Display the three plan cards side by side on desktop and stacked on mobile.

The selected card should be obvious.

Show the key differences without a 60-row comparison table.

Use feature groups:

* Website
* Appointments
* WhatsApp
* Calling
* Clinical Notes
* Reminders
* AI Automation
* Team

For Build Your Own:

After selecting the card, expand an add-on configurator.

Maintain a live summary:

**Base ₹999**

* AI Calling Agent ₹599
* AI WhatsApp ₹699
* Ambient Listening ₹1,499

**Estimated monthly subscription: ₹3,796 + usage**

Use correct arithmetic programmatically.

Do not include variable credit consumption in the fixed monthly subtotal.

Clearly state:

**Usage-based AI and communication charges may use ScheduRx Credits.**

---

# 35. BILLING INTEGRATION

Inspect the existing billing/payment architecture.

If a checkout/subscription flow already exists:

Connect the plan/add-ons to that system.

If billing is not fully implemented:

Persist:

* plan ID
* add-on IDs
* price configuration version
* intended subscription
* selected billing period

and allow onboarding to continue according to existing launch strategy.

Do not fake a successful payment transaction.

No extra eighth onboarding screen should be introduced solely for billing unless the existing architecture already requires an external checkout redirect/modal.

---

# 36. SCREEN 6 — CALL FORWARDING

This screen is optional.

Title:

**Never miss a patient call**

Subcopy:

**Forward unanswered clinic calls to ScheduRx so we can take over when your team can't answer.**

Important:

Default setup should focus on:

**Forward when unanswered**

not unconditional forwarding.

The human receptionist/doctor should still have the opportunity to answer first unless the clinic deliberately selects a different behavior later.

---

# 37. CARRIER SELECTION

Cards/select:

* Jio
* Airtel
* Other

Also show:

**I'll do this later**

Call forwarding should never prevent onboarding completion.

---

# 38. FORWARDING DESTINATION NUMBER

The ScheduRx forwarding/AI destination number must come from backend configuration/environment/clinic telephony provisioning.

Do not hard-code an arbitrary phone number into the frontend.

Conceptually:

`SChedurxForwardingNumber`

or equivalent existing telephony destination.

Display it clearly.

Allow the implementation/configuration team to change the destination number without editing this component's source.

If different clinics get unique numbers, use the clinic's provisioned number.

---

# 39. JIO CALL FORWARDING

Jio supports:

* unconditional
* no answer
* busy
* not reachable

The preferred ScheduRx setup is:

**No Answer**

Initial researched dial template commonly used for Jio:

`*403*{FORWARDING_NUMBER}`

Deactivation:

`*404`

Additional configurable Jio templates may include:

Unconditional:
`*401*{FORWARDING_NUMBER}`

Busy:
`*405*{FORWARDING_NUMBER}`

Not reachable:
`*409*{FORWARDING_NUMBER}`

Disable unconditional:
`*402`

Disable busy:
`*406`

Disable unreachable:
`*410`

Disable all:
`*413`

IMPORTANT:

Carrier implementations can change.

Do not bury these strings directly inside presentation components.

Put the forwarding-code templates in centralized configuration so ScheduRx can update them.

Also provide an official/manual fallback:

**MyJio → Profile → Mobile Settings → Service Settings → Call Forwarding**

and handset:

**Phone/Call Settings → Call Forwarding → When unanswered**

Wording/navigation varies by handset.

---

# 40. AIRTEL CALL FORWARDING

Preferred configuration:

**Forward when unanswered**

Use a centrally configurable Airtel no-answer template.

Initial GSM/Airtel-style template:

`*61*{FORWARDING_NUMBER}#`

Deactivation:

`##61#`

Keep related configurable templates available:

Unconditional:

`*21*{FORWARDING_NUMBER}#`

Busy:

`*67*{FORWARDING_NUMBER}#`

Unreachable:

`*62*{FORWARDING_NUMBER}#`

Disable:

`##21#`
`##67#`
`##62#`

Because device/carrier variations exist, show the handset/Airtel app fallback too.

Do not claim the code definitely succeeded merely because the dialer opened.

---

# 41. “SET UP CALL FORWARDING” BUTTON

On supported mobile devices, provide:

**Open Phone App**

Construct an appropriate `tel:` URI containing the configured forwarding code.

Remember that special characters such as `#` may need URI encoding.

Example conceptually:

`tel:*61*9876543210%23`

Do not automatically place the call without the user's action.

The intended behavior:

1. User taps button.
2. Device opens native phone dialer.
3. Dial code is prefilled where supported.
4. User explicitly presses Call.
5. Carrier executes the supplementary-service request.

On desktop:

Do not try to launch unusable phone behavior.

Instead show:

* copy code
* QR or simple instructions if existing design system supports it
* “Continue on your phone” guidance

Do not add a QR dependency unnecessarily if simple copy is sufficient.

---

# 42. FORWARDING VERIFICATION

After setup show:

**I've enabled call forwarding**

Then explain:

**Call your clinic number from another phone and let it ring without answering. The call should route according to the selected ScheduRx setup.**

If ScheduRx has a real telephony webhook that can confirm a test call:

Use it.

If it does not:

Do not display a fake automated verification state.

Allow the user to manually mark:

**Tested successfully**

or:

**I'll verify later**

Persist a simple status such as:

* not_started
* instructions_viewed
* user_confirmed
* verified_by_system if genuinely verifiable

---

# 43. SCREEN 7 — INVITE YOUR TEAM

Title:

**Bring your team to ScheduRx**

Subcopy:

**Invite doctors and receptionists. Their clinic settings will already be ready when they join.**

This is the final onboarding screen.

---

# 44. INVITATION MODEL

Use secure server-generated invitations.

Each invite should have:

* workspace/clinic ID
* intended role
* creator ID
* creation time
* expiration time
* usage status/count
* optional maximum uses
* random secure token
* short human-readable code
* revocation state

Do not use predictable sequential invite tokens.

Store secrets safely.

Prefer hashing sensitive raw invitation tokens where compatible with the existing invitation architecture.

Do not leak invite tokens into unnecessary analytics or server logs.

---

# 45. INVITE UI

Role selector:

* Doctor
* Receptionist

Then:

**Generate Invite**

Display:

### Invite link

Example conceptually:

`https://app.schedurx.com/join/....`

Button:

**Copy Link**

### Invite code

Example:

`DR7KQ9`

Button:

**Copy Code**

Use a short code that avoids confusing characters where possible.

Example alphabet could avoid:

O / 0
I / 1 / L

Use sufficient entropy.

Recommended expiry:

7 days by default, centrally configurable.

---

# 46. SHARE OPTIONS

Provide:

### WhatsApp

Construct a prefilled message such as:

**You've been invited to join [Clinic Name] on ScheduRx. Use this link to set up your account: [Invite URL]**

Do not send the WhatsApp message silently.

Open WhatsApp/share target and let the user choose/send.

### Share

Use the Web Share API on supported devices.

Fallback:

Copy link.

---

# 47. SOLO-PRACTICE INVITE RULES

A Solo workspace permits at most one doctor.

Normally, after the owner doctor completes onboarding:

Default invite role:

**Receptionist**

Do not allow inviting another doctor when a doctor already exists.

However, handle the edge case where a receptionist created the Solo workspace.

If the workspace currently contains **zero doctors**:

Allow the owner/admin to generate exactly one Doctor invitation.

Once that doctor joins:

Disable additional Doctor invitations.

This enforces:

**one doctor + multiple receptionists**

without making it impossible for a receptionist to set the clinic up on the doctor's behalf.

---

# 48. POLYCLINIC INVITE RULES

For `polyclinic`:

Allow:

* Doctor invitations
* Receptionist invitations

Multiple of each.

Respect existing seat/billing limits.

If an additional doctor seat requires subscription adjustment, surface the correct existing billing behavior instead of silently creating an unpaid seat.

---

# 49. REMIND ME LATER

Screen 7 must have:

**Invite later**

or:

**I'll invite my team later**

This should complete onboarding.

Invites are not mandatory.

The clinic owner should be able to access team management from the main application later.

---

# 50. COMPLETE SETUP

Final CTA:

**Go to ScheduRx**

or:

**Open my clinic**

When clicked:

1. persist final onboarding completion
2. ensure workspace configuration exists
3. ensure the authenticated creator has proper membership
4. initialize any necessary default clinic configuration safely
5. route to the existing dashboard/home
6. do not show onboarding again unless explicitly restarted by product logic

A small completion animation is fine.

Do not create a lengthy eighth “Congratulations” screen.

---

# 51. INVITED USER ONBOARDING FLOW

This is crucial.

A team member clicking an invitation should NOT reconfigure organization-level information.

The invitation already establishes:

* workspace
* clinic
* practice type
* plan
* clinic profile
* clinic hours
* reception number
* plan entitlements
* telephony setup

Therefore invited-member onboarding should be dramatically shorter.

Conceptual flow:

**Invite → Google Auth → Personal Profile → Personal Working Hours → Enter Clinic**

Organization-level screens should be inherited.

Do not ask invited receptionists to choose the clinic's subscription plan.

Do not ask invited doctors to overwrite clinic fees/hours unless their permissions and existing product model specifically require doctor-level overrides later.

Do not ask non-admin users to configure call forwarding.

---

# 52. INVITE USER — ROLE BEHAVIOR

If invitation explicitly says:

`receptionist`

Then role should be preselected as Receptionist.

Prefer locking it unless an administrator-approved role change mechanism exists.

If invitation says:

`doctor`

Then show Doctor professional fields.

For a generic role-neutral Polyclinic invitation, role selection may be allowed, but role-specific invitations are safer.

For Solo practice:

default team invite is Receptionist unless the zero-doctor exception described earlier applies.

---

# 53. INVITED DOCTOR

An invited doctor should configure their own:

* name
* Google-linked email
* doctor phone
* UPI if desired
* experience
* specialization
* bio
* photos
* qualifications
* registrations
* hospital affiliations
* services
* awards
* memberships
* languages
* additional information
* personal availability
* breaks

They inherit:

* clinic identity
* clinic address
* reception number
* clinic hours
* selected subscription
* workspace entitlements

Doctor-specific fee or appointment duration should inherit the clinic default unless the existing ScheduRx product supports provider overrides.

If overrides exist, allow them later in settings rather than adding unnecessary complexity to invite onboarding.

---

# 54. INVITED RECEPTIONIST

Receptionist onboarding should remain very lightweight.

Collect:

* editable name
* Google email read-only
* personal phone if useful to current staff system
* personal working hours
* breaks if useful

Do not show:

* medical degrees
* doctor experience
* specialization
* awards
* medical council
* doctor biography
* doctor photos
* UPI payout information unless an existing staff-payroll feature specifically needs it

Do not ask a receptionist to configure clinic subscription unless they are the workspace owner/admin and the application explicitly allows it.

---

# 55. DATA RELATIONSHIPS

Do not make a giant onboarding table containing everything.

Data should end up in the canonical product models.

Conceptually:

## Auth user

Contains identity/auth information.

## Workspace / Organization / Clinic

Contains shared practice information.

## Membership

Connects user to clinic and stores permissions/role references.

## Doctor profile

Contains doctor-specific public/professional information.

## Staff/receptionist profile

Contains staff-specific data if current architecture uses one.

## Availability

Contains user/doctor working hours.

## Clinic operating hours

Contains organization-level opening hours.

## Calendar blocks

Contains breaks/unavailable periods.

## Appointment configuration

Contains:

* slot duration
* booking rules
* fees where appropriate
* token amount

## Subscription

Contains plan selection.

## Entitlements

Controls actual feature access.

## Credit wallet / usage ledger

Controls usage-based AI resources.

## Invitations

Controls secure team joining.

## Telephony configuration

Contains forwarding destination/setup state where appropriate.

Use the application's actual equivalent models.

---

# 56. WEBSITE INTEGRATION

Doctor/clinic profile information gathered during onboarding should automatically populate the existing ScheduRx website/profile system where appropriate.

Map:

Doctor name → doctor heading
Specialization → doctor specialization
Experience → experience
Bio → doctor description
Photos → doctor media
Education → qualifications
Hospital affiliations → experience/affiliations
Awards → awards
Memberships → memberships
Services → services
Languages → languages
Clinic name → website clinic name
Clinic address → location/contact
Clinic reception number → contact/booking contact according to privacy rules
Clinic description → about section
Clinic logo/photos → website media
Consultation fee → booking information
Working hours → availability/open hours

Do not expose:

* private UPI information
* private phone information not intended for public use
* internal medical registration documents
* invite tokens
* billing data

Use existing privacy/display flags where they exist.

---

# 57. APPOINTMENT INTEGRATION

The following onboarding fields must not just sit in the database.

They need to affect the actual application.

### Doctor availability

Connect to canonical appointment availability.

### Clinic hours

Act as clinic-level operating constraints.

### Breaks

Create/use canonical blocked time.

### Slot duration

Feed actual slot generation.

### Fee

Feed patient-facing booking/checkout where existing system supports it.

### Token amount

Feed appointment-confirmation/payment behavior where supported.

### Plan entitlements

Determine which patient communication channels and AI capabilities are available.

Do not create duplicated scheduler logic inside onboarding.

---

# 58. TELEPHONY INTEGRATION

Plan selections must result in feature entitlements such as conceptual:

### Core

`missed_call_safety_net = true`

`ai_inbound_voice = false`

`ai_outbound_voice = false`

### Autopilot

`missed_call_safety_net = true`

`ai_inbound_voice = true`

`ai_outbound_voice = true`

### Custom

Determined from add-ons.

Use actual feature names from the codebase.

If telephony numbers need provisioning asynchronously by an external provider, integrate with the existing provisioning system.

Do not invent a working number in frontend code.

---

# 59. WHATSAPP INTEGRATION

Conceptual plan behavior:

### Core

`whatsapp_structured_booking = true`

`whatsapp_conversational_ai = false`

### Autopilot

both true

### Build Your Own

conversational AI depends on selected module.

Do not fork appointment state by communication channel.

Whether appointment originates from:

* website
* dashboard
* WhatsApp
* AI voice
* receptionist

it should enter the same canonical appointment system.

---

# 60. CLINICAL NOTES INTEGRATION

Conceptual:

### Clinic Core

Voice-note workflow available.

Ambient listening unavailable.

### Clinic Autopilot

Voice notes + ambient listening.

### Build Your Own

Ambient based on module.

Use existing notes/clinical AI system.

Do not build a new audio recorder if one already exists.

---

# 61. REMINDER/FOLLOW-UP INTEGRATION

### Core

Text/WhatsApp reminders and follow-ups.

### Autopilot

AI voice reminders/follow-ups/rescheduling where implemented.

### Custom

According to:

* recorded-call module
* AI follow-up module
* AI calling module

Use existing jobs/queue/scheduler.

Do not create browser-dependent reminder timers.

---

# 62. VALIDATION SUMMARY

All important validation must happen server-side as well as client-side.

### Google email

Verified by OAuth.

Read-only from onboarding.

### Indian phone

Canonical:

`+91` + 10 digits

Display fixed +91.

### PIN code

6 digits.

### Experience

integer, 0–80.

### Years

valid four-digit values within sensible historical/current bounds.

### Currency

INR.

No floating point money.

### Slot duration

valid supported/custom integer.

### Photos

maximum 5 doctor images.

Use secure file validation.

### Working time

start < end.

### Break

must be logically valid.

### Token amount

positive if enabled.

### Invite

valid, unexpired, unrevoked, unconsumed according to usage policy.

Do not rely on HTML attributes alone.

---

# 63. OPTIONAL VS REQUIRED

Keep the initial setup easy.

The genuinely essential data for a brand-new workspace is approximately:

* authenticated Google identity
* practice type
* current user's role
* enough clinic identity/configuration to create the workspace
* plan selection or default
* onboarding completion

Most richer profile fields should be optional.

Clearly label optional information.

Do not sprinkle red asterisks everywhere.

If a field is optional, blank values must save safely.

Do not submit empty strings if canonical backend conventions prefer null.

---

# 64. PROGRESSIVE DISCLOSURE

Screen 3 especially could become extremely long.

Do not show everything expanded.

Suggested accordion organization:

### Your Details

Expanded by default.

### Professional Profile

Doctor only.

### Qualifications & Registration

Doctor only.

### Experience & Recognition

Doctor only.

### Website/Profile Extras

Doctor only.

### Photos

Doctor only.

### Working Hours

Expanded or prominently visible.

### Additional Information

Collapsed.

Screen 4:

### Clinic Essentials

Expanded.

### Appointment Settings

Expanded.

### Clinic Hours

Expanded.

### Address & Public Profile

Collapsed or partially expanded.

### Advanced Settings

Collapsed.

Preserve values when sections collapse.

---

# 65. COMPONENT REUSE

Build reusable primitives rather than seven giant components.

Likely reusable pieces include:

* onboarding layout
* onboarding progress
* section accordion
* India phone input
* INR money input
* weekly schedule editor
* time range picker
* recurring break editor
* media uploader
* repeatable field group
* role selector
* plan card
* add-on selector
* credit balance display
* invite card
* copy/share action
* call-forwarding instructions

Before building these, inspect whether equivalents already exist.

Do not duplicate an existing design-system component.

---

# 66. MOBILE UX

This onboarding will often be completed on a doctor's phone.

Mobile is first-class.

Requirements:

* no horizontal scrolling
* sticky Continue action where appropriate
* phone-friendly time picker
* day buttons must fit
* plan cards become stacked
* add-on subtotal remains readable
* accordions remain easy to operate
* uploaded-photo previews remain manageable
* call-forwarding dial action prominently works on mobile
* native share API should be used when supported
* Google button follows authentication best practices

Do not assume desktop.

---

# 67. ERROR HANDLING

Every step needs useful errors.

Do not display technical stack traces.

Handle:

* network failure
* duplicate save
* expired session
* Google authentication failure
* database failure
* invalid invite
* image upload failure
* insufficient permission
* billing configuration unavailable
* telephony number unavailable
* malformed schedules

Preserve user-entered values after recoverable failures.

---

# 68. LOADING STATES

Use proper loading/skeleton/spinner patterns consistent with the app.

Prevent double clicks.

Google sign-in:

show authenticating state.

Uploads:

show individual upload progress where infrastructure permits.

Continue:

show saving state.

Invites:

show generating state.

Plan:

show price calculation synchronously where possible.

Do not block the entire UI unnecessarily.

---

# 69. SECURITY

This is healthcare-adjacent software, so do not be casual with account boundaries.

Enforce authorization server-side.

A user must never be able to change a clinic simply by altering a workspace ID in a request.

Invite token must be validated server-side.

Plan entitlements must be enforced server-side for expensive functions.

Do not trust client plan state.

Do not trust client credit balance.

Do not expose UPI IDs unnecessarily.

Do not place sensitive tokens in client analytics.

Do not store OAuth access tokens somewhere insecure merely for onboarding.

Do not log full invite URLs if avoidable.

---

# 70. PRIVACY

Profile fields have different visibility levels.

Conceptually separate:

### Authentication/private

* Google subject
* email

### Internal contact

* personal phone
* UPI

### Potentially public doctor profile

* name
* profile photo
* specialization
* experience
* bio
* qualifications
* hospital affiliations
* awards
* memberships
* services
* languages

### Public clinic profile

* clinic name
* clinic public contact as configured
* address
* hours
* fees
* facilities
* clinic photos

Do not automatically publish every collected field.

Respect existing public/private profile architecture.

---

# 71. STATE TRANSITIONS

A new Solo doctor should follow:

Google Auth
→ Solo
→ Doctor profile
→ Clinic configuration
→ Plan
→ Call forwarding
→ Invite receptionists
→ Dashboard

A new Polyclinic doctor/admin:

Google Auth
→ Polyclinic
→ Doctor profile
→ Clinic configuration
→ Plan
→ Call forwarding
→ Invite doctors/receptionists
→ Dashboard

A Solo receptionist creating a workspace:

Google Auth
→ Solo
→ Receptionist profile
→ Clinic configuration
→ Plan
→ Call forwarding
→ invite exactly one Doctor and any reception staff
→ Dashboard

Invited Solo receptionist:

Invitation
→ Google Auth
→ Receptionist personal profile
→ Personal hours
→ Dashboard

Invited Solo doctor where clinic currently has no doctor:

Invitation
→ Google Auth
→ Doctor professional profile
→ Personal availability
→ Dashboard

Invited Polyclinic doctor:

Invitation
→ Google Auth
→ Doctor professional profile
→ Personal availability
→ Dashboard

Invited Polyclinic receptionist:

Invitation
→ Google Auth
→ Receptionist profile
→ Personal availability
→ Dashboard

Do not force invite users through irrelevant organization screens merely to maintain a numerical seven-step route.

---

# 72. ONBOARDING AND SETTINGS MUST SHARE DATA

Anything configured here should later be editable through the existing appropriate settings area.

Do not make onboarding configuration permanent or inaccessible.

Examples:

Doctor profile → Doctor/Profile Settings
Doctor availability → Availability/Calendar Settings
Clinic hours → Clinic Settings
Clinic address → Clinic Profile
Appointment duration → Appointment Settings
Fee/token → Booking/Payment Settings
Plan → Billing
Call forwarding → Calling/Telephony Settings
Team invites → Team Management

If those settings screens already exist, onboarding should call the same APIs/data models.

If they do not, at minimum store data in a way that makes future settings editing straightforward.

---

# 73. DO NOT RESET DATA AFTER ONBOARDING

If an existing user later reopens an onboarding URL accidentally:

Do not overwrite working clinic configuration with defaults.

Completed onboarding should normally redirect into the app.

If you add an internal development/reset function, do not expose it to ordinary users.

---

# 74. SCHEMA / MIGRATIONS

Inspect current schema first.

Only add fields/tables that are genuinely missing.

Potential missing concepts may include:

* onboarding progress
* invite code/token metadata
* plan add-on selection
* credit ledger
* call forwarding onboarding status
* generic extra profile fields

But do not assume these are missing.

If migrations are needed:

* make them reversible where project conventions support it
* preserve existing records
* add sensible defaults/nullability
* do not accidentally mark millions of existing optional fields required
* backfill existing clinics as onboarding completed if necessary so existing users are not trapped in new onboarding

Existing customers should not suddenly be redirected to onboarding after deployment.

---

# 75. EXISTING CUSTOMER MIGRATION RULE

Critical:

When introducing `onboarding_completed` or equivalent, existing legitimate workspace users must be treated as already onboarded unless there is explicit evidence otherwise.

Do not launch this migration and accidentally lock every current user behind Screen 2.

---

# 76. ANALYTICS

If the application already has product analytics, instrument useful events without recording sensitive form values.

Potential events:

* onboarding_started
* google_auth_completed
* invite_code_entered
* practice_type_selected
* onboarding_personal_completed
* onboarding_clinic_completed
* onboarding_plan_selected
* onboarding_call_forwarding_viewed
* onboarding_call_forwarding_skipped
* onboarding_invite_generated
* onboarding_completed

Properties may include safe metadata such as:

* step
* practice type
* selected plan ID
* role
* invite vs new workspace

Do not send:

* UPI IDs
* phone numbers
* medical registration numbers
* raw invite tokens
* biographies
* private document URLs

---

# 77. ACCESSIBILITY

Meet existing accessibility standards.

Ensure:

* keyboard navigation
* clear labels
* visible focus states
* semantic buttons
* form errors tied to controls
* appropriate ARIA for accordions
* sufficient contrast
* non-color-only selection states
* screen-reader-friendly progress

Do not sacrifice accessibility for glassmorphism.

---

# 78. QA / TEST CASES

At minimum test the following.

## Authentication

Google auth success.

Google auth cancellation.

Existing completed user.

Existing partially onboarded user.

## Solo owner doctor

Can finish all screens.

Doctor role reveals doctor fields.

Can invite receptionists.

Cannot invite second doctor.

## Solo owner receptionist

Doctor profile fields hidden.

Can complete clinic setup.

Can invite one doctor because workspace currently has zero doctors.

After doctor joins, cannot invite another.

## Polyclinic

Can invite multiple doctors.

Can invite multiple receptionists.

Each doctor gets independent availability/profile.

## Invite

Valid invite link.

Valid short code.

Invalid invite.

Expired invite.

Revoked invite.

Already-used single-use invite.

Logged-in existing user accepting invite.

## Phone

Reject fewer than 10 digits.

Reject more than 10 digits.

Reject alphabetic characters.

Normalize to `+91`.

## Token amount

Hidden when disabled.

Required/valid when enabled according to chosen optional-field behavior.

Reject negative amount.

## Working hours

Toggle day.

Time editing.

Copy hours.

Break creation.

Break deletion.

Reject end before start.

Reject invalid overlapping breaks.

Persist after reload.

## Clinic vs personal hours

Stored independently.

Do not overwrite one with the other.

## Plan

Core entitlements correct.

Autopilot entitlements correct.

Custom module toggles correct.

Subtotal correct.

## Credits

Server computes usage.

No duplicate debit from duplicate webhook.

No race-condition negative balance.

## Call forwarding

Jio instructions.

Airtel instructions.

Other carrier fallback.

Phone dialer link generated from configured destination.

Skip works.

## Team

Generate link.

Generate code.

Copy.

Native share.

WhatsApp share.

Invite later.

## Resume

Close onboarding after Screen 4.

Reopen application.

Resume correctly with saved values.

## Existing customer

Existing pre-onboarding-era clinic does not get unexpectedly forced through flow.

---

# 79. ACCEPTANCE CRITERIA

The feature is done only when:

1. A completely new doctor can Google-sign-in and configure a clinic.
2. No OTP flow was created.
3. Solo and Polyclinic branching works.
4. Doctor and Receptionist branching works.
5. Google name prefill works.
6. Google email is read-only.
7. Doctor profile data persists.
8. Doctor photos support up to five images.
9. Doctor professional details are optional and progressively disclosed.
10. Personal working hours persist and feed the canonical availability system.
11. Breaks feed the canonical blocking system.
12. Clinic reception number is collected only at clinic level.
13. Indian phone validation works.
14. Clinic hours remain separate from individual hours.
15. Slot length feeds real scheduling settings.
16. Fee/token data feeds existing relevant configuration.
17. Three plans work through centralized entitlement logic.
18. Custom add-ons produce a correct monthly subtotal.
19. Usage-based AI integrates with a server-side credit ledger or existing usage system.
20. Premium enables intended premium entitlements but does not imply infinite AI usage.
21. Call-forwarding screen supports Jio and Airtel plus fallback instructions.
22. Forwarding destination is configurable.
23. Users can skip call-forwarding setup.
24. Users can invite team members through secure links/codes.
25. WhatsApp/native sharing works where supported.
26. Solo workspaces enforce one doctor.
27. Polyclinics allow multiple doctors.
28. Invited users inherit clinic configuration.
29. Invited users do not reconfigure billing/clinic settings unless authorized.
30. Onboarding can be resumed safely.
31. Existing customers are not broken.
32. Existing app functionality remains intact.
33. Relevant tests/build/type checks pass.

---

# 80. IMPLEMENTATION APPROACH

Do not ask me to manually identify every relevant existing file.

Inspect the repository and make reasonable engineering decisions.

When you find an existing equivalent feature, use it.

Examples:

If there is already a `WorkingHoursEditor`, reuse/refactor it.

If blocked time already has a recurring-weekly model, use it.

If doctor profile already supports qualifications, connect the onboarding field to it.

If a clinic already has `appointmentDuration`, do not create `onboardingSlotLength`.

If billing already has feature IDs, extend those feature IDs.

If the AI calling system already meters seconds, layer credit conversion onto its existing usage event rather than metering separately in the browser.

If a team invitation system already exists, extend it with onboarding codes rather than creating a second invitation backend.

If an OAuth user already has an avatar, use the existing identity record.

The onboarding should be an orchestration layer over ScheduRx's existing product capabilities.

---

# 81. DO NOT DO THESE THINGS

Do not:

* add OTP authentication
* create a fake backend
* create mock data in production code
* create an isolated onboarding demo
* create duplicate clinic/user/calendar models
* replace existing scheduling logic
* replace working authentication
* overwrite existing user data
* force existing clinics through onboarding
* make all doctor profile fields mandatory
* expose a doctor's UPI publicly
* let client-side code grant Premium privileges
* let client-side code deduct credits
* hard-code the ScheduRx forwarding number
* automatically place call-forwarding calls without user action
* claim forwarding succeeded merely because the dialer opened
* make invite links predictable
* expose invite tokens in analytics
* allow a Solo clinic to accumulate multiple doctors
* ask an invited receptionist to choose the clinic's billing plan
* make clinic hours and personal hours the same field
* create a second time-blocking system for lunch breaks
* implement prices separately in multiple components
* fake billing/payment completion
* silently discard form data on refresh
* use generic green healthcare styling
* overfill the screens with every accordion open

---

# 82. FINAL UX DETAILS

Use microcopy that is concise, confident, and reassuring.

Good:

**Set up your clinic**

**Tell us how your practice works**

**Your professional profile**

**When are you usually available?**

**Set your clinic hours**

**Choose how much ScheduRx should automate**

**Never miss a patient call**

**Bring your team**

Avoid bloated copy such as:

“Please enter the relevant details pertaining to the operating schedule of your medical establishment.”

Keep tooltips/help text available where a concept might confuse a doctor.

Show small autosave reassurance where appropriate:

**Saved**

Do not show intrusive success toasts after every field.

---

# 83. SUCCESS EXPERIENCE

After the creator completes onboarding, the ScheduRx dashboard should already understand:

* who this person is
* whether they are doctor or receptionist
* which clinic they belong to
* whether the clinic is Solo or Polyclinic
* doctor information
* clinic information
* doctor/staff working hours
* clinic operating hours
* calendar blocking/breaks
* appointment duration
* consultation fee
* token-money preference
* selected product plan
* selected custom modules if applicable
* AI/communication entitlements
* initial credit allocation/wallet
* whether forwarding setup was completed/skipped
* team members invited
* public website/profile data

The user should **not** enter the dashboard and immediately be asked to configure the same information again.

This is the key outcome.

---

# 84. AFTER IMPLEMENTATION

After making the code changes:

1. Review all changed files.
2. Run migrations/schema validation if needed.
3. Run lint.
4. Run type checking.
5. Run relevant unit/integration tests.
6. Run application build.
7. Fix errors you introduced.
8. Verify responsive behavior.
9. Verify new-user and invited-user flows.
10. Verify existing users still enter the application normally.

Then give me a concise implementation report containing:

* architecture used
* files/modules materially changed
* schema changes
* APIs/endpoints added or extended
* feature-entitlement mapping
* invite behavior
* credit-metering behavior
* any assumptions you had to make
* any external environment variables/provider configuration I still need to supply
* tests/checks run and their results

Do not stop at a design proposal. Make the feature production-integrated.
