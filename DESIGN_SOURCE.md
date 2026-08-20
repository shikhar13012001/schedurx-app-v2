# SCHEDURX ONBOARDING — DESIGN SAUCE / VISUAL CONTEXT

## READ THIS TOGETHER WITH THE MAIN ONBOARDING IMPLEMENTATION PROMPT

This document is **visual and interaction context** for the ScheduRx onboarding flow described in the main prompt.

It is **not** a second request to redesign the entire ScheduRx platform.

The main ScheduRx application has already undergone a substantial visual redesign.

Your task now is:

> **Understand the design system that is currently implemented in the repository, then make the new onboarding experience look and feel as if it was designed at the same time, by the same product/design team, using the same visual language.**

The onboarding must not feel bolted on.

It must not feel like:

* a separate SaaS signup wizard,
* a shadcn form template,
* a Stripe-style generic onboarding flow,
* a Material UI stepper,
* an admin configuration page,
* or a collection of generic white form cards.

It should feel unquestionably like **ScheduRx**.

---

# 1. FIRST: STUDY THE CURRENT IMPLEMENTED DESIGN

Before building a single onboarding screen, inspect the current application visually and structurally.

Do not rely only on this document.

The **current implemented ScheduRx UI is the most important source of truth for how the onboarding should actually look today.**

Inspect:

* `src/app/globals.css`
* `tailwind.config.*`
* theme/design tokens
* typography
* page shell
* mobile dock/navigation
* desktop navigation
* button components
* input components
* sheets
* cards/surfaces
* search controls
* avatars
* segmented controls
* status treatments
* motion utilities
* Framer Motion patterns
* breakpoint behavior
* dark/light behavior
* existing onboarding/login screens if any
* current Home experience
* current Calendar
* Current Patient / Now Serving
* Consults
* Patients
* Profile/Settings
* Billing
* Team

Run the app.

Look at it at actual mobile sizes.

Do not infer the visual system purely from class names.

**See what the current product actually looks like.**

If screenshot/browser tooling is available, inspect at minimum:

* 390 × 844
* 430 × 932
* 768 × 1024
* 1280 × 800
* 1440 × 900

The new onboarding should inherit the current application's:

* visual rhythm,
* type scale,
* color treatment,
* geometry,
* surfaces,
* controls,
* motion,
* spacing,
* interaction behavior.

---

# 2. IMPORTANT PRIORITY ORDER

When making design decisions, follow this priority:

### 1. Current production ScheduRx implementation

The current redesigned application is the strongest source of truth.

### 2. Existing ScheduRx design tokens/components

Reuse them wherever appropriate.

### 3. The visual principles in this document

Use these to understand the intent behind the current design.

### 4. Generic UI conventions

Use generic patterns only where ScheduRx has no existing solution.

Do **not** introduce a second visual system specifically for onboarding.

---

# 3. DO NOT REDESIGN THE MAIN PRODUCT AGAIN

The large redesign effort has already happened.

Do not use this onboarding task as an excuse to:

* replace the navigation,
* rewrite Home,
* change the product palette,
* restructure unrelated pages,
* introduce a second component library,
* create a new global theme,
* change existing page hierarchy,
* replace working UI primitives unnecessarily.

You may make small reusable-component improvements where required to support onboarding cleanly, but the goal is:

> **extend the existing ScheduRx design system, not restart it.**

If the repository already has a beautiful field, button, sheet, upload control, segmented selector, time picker, or surface treatment:

**reuse it.**

---

# 4. THE SCHEDURX VISUAL NORTH STAR

ScheduRx should feel like:

**clinical software without looking clinical-software-ish.**

The emotional qualities are:

* premium
* calm
* sophisticated
* editorial
* tactile
* contemporary
* warm
* spatial
* extremely clean
* mobile-native
* confident
* slightly futuristic
* human
* luxurious without decoration
* sparse without becoming empty
* technologically advanced without looking “AI-themed”

It should **not** resemble:

* hospital ERP software
* SaaS admin dashboards
* generic healthcare software
* Bootstrap
* Material UI
* default shadcn
* Tailwind UI templates
* a CRM
* a fintech dashboard
* an enterprise form-builder
* “AI-generated card soup”

---

# 5. CORE VISUAL DNA

The underlying ScheduRx design language is approximately:

```text
warm off-white canvas
+
warm stone / taupe material
+
charcoal
+
one vivid orange
+
soft atmospheric illumination
+
large light typography
+
oversized rounded geometry
+
circular controls
+
thin iconography
+
minimal borders
+
selective glass
+
large negative space
+
controlled asymmetry
+
one dominant visual moment per screen
```

Translate this language into onboarding.

Do not merely paint forms orange.

---

# 6. CORE BRAND COLORS

The central visual anchors are:

```css
--srx-charcoal: #181818;
--srx-stone: #B9B6B1;
--srx-orange: #EC6B25;
--srx-off-white: #F7F7F7;
--srx-white: #FFFFFF;
```

The actual current repository tokens should win if the redesign refined these values.

Do not independently redefine colors if semantic variables already exist.

---

# 7. ORANGE IS PRECIOUS

Orange must remain relatively scarce.

It represents:

* active state
* attention
* warmth
* progress
* selected state
* primary action
* live/AI state where appropriate

It is not the default background of every card or button.

A useful mental ratio is roughly:

```text
60–75% off-white / white
15–25% warm neutral
5–12% orange
remaining charcoal / semantic colors
```

Do not turn onboarding into an orange landing page.

---

# 8. ORANGE SHOULD SOMETIMES APPEAR AS LIGHT, NOT FILL

One of the visual signatures of ScheduRx is that orange can appear as atmospheric illumination.

Instead of:

```css
background: linear-gradient(...)
```

think:

* soft radial illumination
* peach transition
* stone underneath
* subtle cream haze
* extremely blurred edges

Use this sparingly.

Good places during onboarding:

* initial Google sign-in screen
* plan-selection emphasis
* final completion moment
* perhaps a subtle active-progress glow

Do not place animated orange blobs behind every form.

---

# 9. LIGHT MODE IS THE PRIMARY EXPERIENCE

Onboarding will most often occur in light mode.

Treat it as the hero experience.

Primary canvas:

```css
#F7F7F7
```

not sterile pure white everywhere.

White should represent an elevated material or focused input zone.

Warm stone can represent secondary surfaces.

Charcoal provides the visual anchor.

---

# 10. TYPOGRAPHY IS A MAJOR PART OF THE BRAND

ScheduRx should rely on scale and proportion more than font weight.

Use the existing app typography stack.

If relevant, the intended family style is similar to:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Display",
  "SF Pro Text",
  "Geist",
  "Helvetica Neue",
  Arial,
  sans-serif;
```

Do not add proprietary font files.

Do not install another font package unnecessarily.

Use whatever the current application actually uses if it already achieves this visual intention.

---

# 11. TYPOGRAPHY SHOULD BE LIGHT AND EDITORIAL

Avoid default SaaS typography such as:

```text
28px
font-semibold
```

for every title.

Use larger, lighter headings.

A mobile onboarding question may comfortably be:

```css
font-size: clamp(2.6rem, 10vw, 4rem);
font-weight: 300;
line-height: 0.96;
letter-spacing: -0.05em;
```

Exact values should follow the current app.

The point is:

**the question itself can become the visual composition.**

Example:

```text
How is your
practice set up?
```

should occupy meaningful space.

It should not look like:

```text
Step 2
Practice Type
Please choose an option below
[card] [card]
```

---

# 12. DO NOT FEAR LARGE MOBILE TYPOGRAPHY

At ~390px width, use large display type intentionally.

Good:

```text
Let's set up
your clinic.
```

or:

```text
How do you
practice?
```

or:

```text
Tell us about
your clinic.
```

Large headings are not wasted space.

The negative space surrounding them is part of the design.

---

# 13. ONBOARDING IS NOT A FORM WIZARD

This is one of the most important instructions.

Do **not** create:

```text
----------------------------------
Step 3 of 7
Personal information

Name        [____________]
Email       [____________]
Role        [____________]
Experience  [____________]
...
[Back]                  [Next]
----------------------------------
```

That would be functionally correct but visually wrong.

Instead think:

**one main question / decision / configuration context at a time.**

Even when a screen contains several fields, the composition should still have one dominant purpose.

---

# 14. THE SEVEN SCREENS SHOULD EACH HAVE A DISTINCT MOMENT

### Screen 1 — Account

Dominant moment:

**ScheduRx + Google authentication**

Extremely calm.

Few elements.

Potential atmospheric light.

### Screen 2 — Practice

Dominant moment:

**Solo or Polyclinic**

Large two-option decision.

### Screen 3 — You

Dominant moment:

**Who are you and when do you work?**

Personal identity first.

Professional details progressively disclosed.

### Screen 4 — Clinic

Dominant moment:

**How does this clinic operate?**

Clinic basics and schedule.

### Screen 5 — Plan

Dominant moment:

**How much should ScheduRx automate?**

Plan differentiation should feel tangible.

### Screen 6 — Calls

Dominant moment:

**Never miss a patient call.**

Very simple carrier/action flow.

### Screen 7 — Team

Dominant moment:

**Bring the people you work with.**

Invite/share experience.

Do not make all seven screens visually identical.

Their consistency comes from the design system, not from repeating the same card layout.

---

# 15. PROGRESS INDICATOR

The onboarding progress must not look like a conventional enterprise stepper.

Avoid:

```text
1 Account — 2 Practice — 3 Profile — 4 Clinic ...
```

with circles and connector lines consuming the top of mobile.

Use a refined ScheduRx-native treatment.

Potential mobile treatment:

```text
Account                        1 / 7

━━━╵──────────────
```

or thin micro-segments/dots.

Potential desktop treatment can expose slightly more context.

The progress system should:

* remain subtle
* show where the user is
* not compete with the main heading
* work at 320px
* clearly indicate completion

Use orange selectively for the active/current state.

---

# 16. MOBILE FIRST

The onboarding must be designed first around:

```text
390 × 844
393 × 852
430 × 932
```

Also verify:

```text
320
360
375
390
393
412
430
```

Do not create desktop onboarding and shrink it.

Many doctors will complete this entire flow on their phone.

---

# 17. SAFE AREAS

ScheduRx is a PWA/mobile-native-feeling product.

Respect:

```css
env(safe-area-inset-top)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
env(safe-area-inset-right)
```

A sticky bottom Continue button must never collide with a mobile home indicator.

Use `100dvh` where appropriate.

---

# 18. TOUCH TARGETS

Minimum practical interactive target:

```text
44 × 44px
```

Prefer:

```text
48–56px
```

for important controls.

This particularly applies to:

* day-of-week buttons
* arrows
* upload/remove controls
* plan selection
* role selection
* add break
* copy link
* share
* call-forwarding action

---

# 19. FORM FIELDS

Use the currently implemented ScheduRx input style.

If a new variant is required, keep it approximately within this language:

```css
min-height: 54px;
border-radius: 24px;
padding-inline: 18px;
background: rgba(185,182,177,.12);
border: 1px solid rgba(24,24,24,.055);
font-size: 15px;
```

Focus can use:

```css
border-color: rgba(236,107,37,.45);
box-shadow: 0 0 0 4px rgba(236,107,37,.08);
```

Do not introduce rectangular enterprise inputs.

Do not use visible border boxes simply to separate every field.

---

# 20. LABELS

Field labels should generally be:

* sentence case
* quiet
* approximately 12–13px where appropriate
* lower contrast than field content
* generously separated from previous content

Avoid:

```text
FULL NAME *
EMAIL ADDRESS *
PHONE NUMBER *
```

in uppercase tracking-wide text.

Prefer:

```text
Full name
```

```text
Phone number
```

```text
Profile headline
```

---

# 21. OPTIONAL FIELDS

Most doctor-profile fields are optional.

Reflect this visually.

Do not decorate the interface with dozens of red asterisks.

Where helpful, say:

```text
Optional
```

quietly.

Optional advanced content should usually live inside progressive disclosure.

---

# 22. PROGRESSIVE DISCLOSURE IS CRITICAL

Screen 3 contains a substantial amount of doctor information.

It must not initially appear as a wall of 25 inputs.

Use the current ScheduRx expansion/sheet/accordion language.

Potential structure:

```text
Your details
Professional profile
Qualifications & registration
Experience & recognition
Photos
Working hours
Additional information
```

Only the immediate section should be expanded.

Expanded states should feel fluid.

Values must persist while collapsed.

---

# 23. ACCORDIONS SHOULD NOT LOOK LIKE SETTINGS TABLES

Avoid:

```text
--------------------------------
Professional profile       v
--------------------------------
Education                  v
--------------------------------
Awards                     v
--------------------------------
```

with constant dividers.

Use space, typography, and restrained controls.

Potentially:

```text
Professional profile

Specialisation, experience, bio                     ↘
```

as an elegant large row.

Reuse existing ScheduRx patterns if available.

---

# 24. ROUNDNESS

The ScheduRx visual language uses generous radii.

Typical family:

```css
--radius-control: 18px;
--radius-field: 24px;
--radius-card: 28px;
--radius-panel: 36px;
--radius-hero: 42px;
--radius-pill: 999px;
```

Use current implementation values if they differ.

A 30px card radius at 390px width is entirely appropriate.

Do not revert onboarding to `rounded-lg`.

---

# 25. CIRCLES ARE PART OF THE LANGUAGE

ScheduRx repeatedly uses circular controls.

Use them intentionally for:

* Back
* Next
* Add
* Remove
* Upload
* Call
* Copy
* Share
* Close
* Forward
* Small primary actions

Example:

A screen may have a large text CTA paired with:

```text
Continue                [ → ]
```

where the arrow lives in a beautiful circle.

Do not overdo circles, but onboarding should visibly belong to this motif.

---

# 26. BUTTON HIERARCHY

Do not make every action orange.

Use multiple material types.

### Primary

Charcoal pill or orange circle depending on existing implementation.

### Secondary

Warm stone.

### Tertiary

Ghost/text.

### Selected state

White / charcoal / subtle orange illumination depending on context.

### Skip

Quiet text action.

The orange CTA should feel earned.

---

# 27. PRIMARY CONTINUE ACTION

Every major screen should have a clear forward action.

On mobile, consider a sticky bottom action region.

Example:

```text
Back                              Continue  →
```

or:

```text
I'll do this later                     [ → ]
```

But make the geometry consistent with the current app.

Avoid:

```text
[ BACK ] [ NEXT ]
```

two equal rectangular buttons.

Forward action should have clear priority.

---

# 28. DO NOT PUT EVERYTHING INSIDE CARDS

A common AI-generated onboarding mistake is:

```text
card
  card
  card
  card
```

Avoid this.

Some information can exist directly on the canvas.

Use a surface only when it has a material or structural reason.

Examples:

* headline directly on canvas
* role selector as two physical objects
* schedule living on a soft surface
* form fields grouped by whitespace
* plan cards as genuine selectable objects
* invite URL on a focused elevated surface

---

# 29. CARD-IN-CARD IS PARTICULARLY DISCOURAGED

Do not create:

```text
Outer Card
  Personal Information Card
  Working Hours Card
    Monday Card
    Tuesday Card
```

Flatten the hierarchy.

Use:

* sections
* rows
* typography
* spacing
* local soft backgrounds

before adding more rectangles.

---

# 30. GLASS HAS A SPECIFIC PURPOSE

Do not use glass for every form field or card.

Glass is primarily appropriate for floating elements:

* floating progress
* sticky navigation
* hero action
* mobile bottom action area
* modal/sheet chrome
* call-forwarding overlay
* completion surface

Ordinary form content should generally be solid.

---

# 31. SURFACE LOGIC

Think in these material roles:

### Canvas

Warm off-white.

### Elevated information

White.

### Soft functional area

Very light stone.

### Selected / architectural surface

Stone or charcoal depending on context.

### Floating UI

Glass.

### High-focus area

Charcoal.

### Active/important illumination

Orange.

Maintain material logic.

---

# 32. SCREEN 1 — GOOGLE SIGN-IN DESIGN

The account screen should be exceptionally simple.

Do not show seven-step configuration UI before authentication.

Potential visual composition:

```text
ScheduRx


Set up your
clinic.


A few details and your clinic
is ready to run.


[ G   Continue with Google ]


              or


Joining your team?

[ Enter invite code      ] [ → ]
```

Use a subtle atmospheric light field.

Do not place the entire thing inside a centered SaaS auth card.

On desktop, constrain the composition elegantly rather than stretching it.

Google's button should still respect Google's brand/authentication requirements.

---

# 33. INVITE CODE EXPERIENCE

The invite-code entry should be visually secondary to Google signup.

A user joining through an invitation link should see a human acknowledgment such as:

```text
You've been invited to
Gupta Heart Clinic.

Receptionist
```

Do not show technical token information.

The invite state should feel like an extension of the account screen, not an error/debug mode.

---

# 34. SCREEN 2 — SOLO VS POLYCLINIC

This should be one of the most visually simple screens.

Large heading:

```text
How is your
practice set up?
```

Then two substantial selectable objects.

Not tiny radio buttons.

Potential structure:

```text
01

Solo practice

One doctor with one or more
receptionists.

                                  →
```

and:

```text
02

Polyclinic

Multiple doctors and a shared
clinic team.

                                  →
```

Selected card can gain:

* slight elevation
* charcoal foreground change
* subtle orange edge/light
* movement of 1–2px

Do not fill both options with bright color.

---

# 35. ROLE SELECTION

Doctor / Receptionist should use a tactile segmented or two-card choice.

Avoid a dropdown.

The decision changes a large part of the upcoming experience, so it deserves visible space.

Example:

```text
I work here as

[ Doctor            ]
[ Receptionist      ]
```

or side-by-side where screen width permits.

Use the design language already used for major choices elsewhere in the app.

---

# 36. GOOGLE PREFILLED DATA

The name field should feel immediately personalized.

If Google returned:

```text
Dr. Meera Kapoor
```

show it.

Email is read-only.

Read-only should not look disabled/broken.

Use a visually quieter field treatment and potentially a small verified/Google identity indicator.

Do not use low-opacity text that becomes difficult to read.

---

# 37. DOCTOR PROFILE

Do not present professional profile entry as a government form.

This information may later populate a beautiful public doctor website.

The onboarding should communicate that benefit.

Potential contextual copy:

```text
Build your profile

We'll use this to prepare your
ScheduRx doctor page.
```

Then progressive sections.

The form can feel editorial rather than bureaucratic.

---

# 38. PHOTO UPLOAD

The doctor-photo section is a strong opportunity for tactile UI.

Do not show a standard file input.

Use:

* large primary image placeholder
* small additional image slots
* circular + action
* drag/reorder if supported
* subtle image cropping
* clear selected-primary state

Example:

```text
Photos

[       Primary photo       ]

[ + ] [ + ] [ + ] [ + ]
```

Respect the maximum of five.

On mobile, maintain sensible thumbnail sizes.

Use existing media components if available.

---

# 39. REPEATABLE PROFESSIONAL FIELDS

Qualifications, affiliations, awards, memberships, etc. should not become mini-card soup.

A repeatable group could look like:

```text
Qualifications

MBBS
AIIMS New Delhi · 2014                       →

MD Dermatology
PGIMER · 2018                                →

+ Add qualification
```

Editing can open inline or in a sheet depending on current ScheduRx conventions.

This is cleaner than rendering four input fields permanently for every entry.

---

# 40. WORKING HOURS IS A SIGNATURE INTERACTION

Treat availability as a beautifully designed scheduling object.

It should not resemble a spreadsheet.

Day selector:

```text
M   T   W   T   F   S   S
```

Use small rounded/circular controls with comfortable targets.

Selected day:

* clear
* tactile
* perhaps charcoal/white or orange accent

Unselected:

* warm soft neutral

---

# 41. WORKING-HOURS ROWS

Each selected day can resemble:

```text
Monday

9:00 AM                         5:30 PM
   └──────────────→──────────────┘
```

or use the current time-picker design.

Avoid a dense table:

```text
MON | 09:00 | 17:30
TUE | 09:00 | 17:30
```

Provide:

```text
Apply to all working days
```

as an elegant shortcut.

---

# 42. BREAKS

Breaks should feel directly connected to calendar blocking.

Example:

```text
Lunch
1:00 PM — 2:00 PM                         ×

+ Add break
```

Do not bury Lunch/Snack/Dinner inside deeply nested cards.

If custom labels are supported, allow them through the same visual mechanism.

---

# 43. CLINIC INFORMATION

Screen 4 should visually transition from **person** to **place**.

Large heading:

```text
Now, your
clinic.
```

Core clinic identity first:

* clinic name
* reception number
* clinic address

Then appointment settings.

Then clinic hours.

Do not open five advanced sections simultaneously.

---

# 44. INDIAN PHONE INPUT

The `+91` treatment should look intentional.

Example:

```text
Phone number

╭──────────────────────────────╮
│ +91   98765 43210            │
╰──────────────────────────────╯
```

`+91` should feel fixed but not visually like a disabled browser input.

Use formatting while typing if existing form conventions permit.

Store canonical data separately.

---

# 45. MONEY INPUT

INR controls should make the currency obvious without clutter.

Example:

```text
Consultation fee

₹   800
```

Avoid:

```text
Currency: INR [dropdown]
Amount: [800]
```

unless internationalization already requires it.

When token money toggles on, animate the amount control into the composition.

---

# 46. YES / NO TOGGLES

Questions such as:

```text
Collect an advance to confirm appointments?
```

should feel conversational.

Use a ScheduRx-native switch or segmented choice.

Not an HTML checkbox with a long form label.

---

# 47. SCREEN 5 — PLAN SELECTION

This screen is not merely a billing table.

The design question is:

> **How much of the clinic should ScheduRx run for you?**

Potential heading:

```text
How much should
ScheduRx automate?
```

Plan selection should communicate increasing levels of automation visually.

---

# 48. PLAN CARD VISUAL HIERARCHY

The three plans:

* Clinic Core
* Clinic Autopilot
* Build Your Own

should not become an enormous SaaS feature matrix.

Each card should emphasize:

1. plan name
2. one-sentence positioning
3. price
4. 4–6 key capabilities
5. what makes it fundamentally different

Autopilot can be visually dominant without turning entirely orange.

Potential emphasis:

* darker/charcoal focus surface
* warm orange illumination
* “Recommended” small label
* stronger scale

Core and Custom remain quieter.

---

# 49. PREMIUM / AUTOPILOT SHOULD FEEL LIKE THE SCHEDURX PROMISE

Clinic Autopilot represents:

**Your clinic, on autopilot.**

Its visual treatment can feel more alive.

Potentially:

```text
Clinic Autopilot

₹4,499 / month

AI calls
AI WhatsApp
Ambient listening
AI follow-ups
Online consultations

1,517 AI credits included

                              [ → ]
```

Use orange as light/highlight.

Do not create six orange badges.

---

# 50. BUILD YOUR OWN

When selected, the module configurator should expand elegantly underneath.

Modules can be large clean rows:

```text
AI Calling Agent

Conversational patient calls
₹599 / month + usage

                               [toggle]
```

Running total should remain visible but quiet.

Potential sticky summary:

```text
₹2,646 / month
+ usage

Continue                               →
```

Do not force the user to mentally add module prices.

---

# 51. CREDIT UI

Credits must feel like a product-resource concept, not cryptocurrency.

Avoid:

* coin icons
* gold gradients
* gaming visuals
* token imagery

Use straightforward language:

```text
1,517 ScheduRx Credits included

≈ 190 AI voice minutes if used
entirely on calls.
```

The visual style should remain clinic/product oriented.

---

# 52. SCREEN 6 — CALL FORWARDING

This screen should be much simpler than the underlying telephony logic.

Large heading:

```text
Never miss
a patient call.
```

Then explain:

```text
When your clinic doesn't answer,
ScheduRx can take over.
```

Carrier selection:

```text
[ Jio ]
[ Airtel ]
[ Other ]
```

Then only show the relevant instructions.

Do not show a giant technical page containing every GSM forwarding code simultaneously.

---

# 53. CALL-FORWARDING ACTION

On mobile, the main action can be strong and simple:

```text
Set up forwarding                       ↗
```

or:

```text
[ phone ]  Open Phone
```

with a circular ScheduRx action.

Below it:

```text
You will still need to press Call.
```

Very clear.

Use technical dial codes as secondary information.

---

# 54. TESTING CALL FORWARDING

After configuration:

```text
One quick check

Call your clinic from another phone
and let it ring.

[ It worked ]

I'll verify later
```

Do not present fake success animations unless the telephony backend genuinely confirmed a forwarded call.

---

# 55. SCREEN 7 — TEAM

This screen should feel warm and human rather than administrative.

Large heading:

```text
Bring your
team.
```

Potential role cards:

```text
Doctor
Receptionist
```

Then a focused invite surface.

Example:

```text
Receptionist invite

schedurx.com/join/....

DR7KQ9

[ WhatsApp ] [ Share ] [ Copy ]
```

On mobile, use Web Share when possible.

---

# 56. TEAM INVITES SHOULD FEEL LIKE SHARING, NOT USER MANAGEMENT

Do not make the final onboarding screen resemble:

```text
Email | Role | Permissions | Status | Actions
```

The sophisticated team-management UI can exist later in Settings.

Onboarding only needs:

* role
* invite
* share
* optional additional invite
* skip

---

# 57. “INVITE LATER” IS IMPORTANT

Do not visually guilt the user into inviting people.

Use a clear secondary action:

```text
I'll invite them later
```

Completing onboarding should remain easy.

---

# 58. SUCCESS MOMENT

Do not add an eighth “Congratulations!” page.

After the final action, allow a short completion transition.

Potentially:

* progress completes
* orange light gently resolves
* CTA becomes “Open my clinic”
* brief “Your clinic is ready” state

Then enter the actual product.

Keep it under a moment.

Do not add confetti.

Do not add a Lottie celebration unless the current app already has such language—which it probably should not.

---

# 59. MOTION LANGUAGE

Use the same Framer Motion language as the current app.

General feel:

```text
press               100–140ms
micro                160–220ms
standard             240–320ms
screen/section       300–420ms
sheet                320–420ms
```

Easing should feel physical and calm.

Use motion to explain:

* next step
* accordion expansion
* selected role
* plan expansion
* newly enabled token-money field
* day selection
* add/remove break
* upload
* invitation generation

Do not animate merely because you can.

---

# 60. SCREEN TRANSITIONS

Avoid aggressive horizontal carousel movement.

A step transition can be:

* slight vertical movement
* opacity transition
* 8–16px spatial shift
* persistent surrounding shell

It should feel fast.

Doctors should never wait for decorative transitions.

---

# 61. PRESSED STATES

Important touch interactions should respond.

Something around:

```css
transform: scale(.975);
```

can work.

Use existing ScheduRx button/Framer primitives where possible.

Do not bounce every control.

---

# 62. SELECTED STATES

Selected cards should communicate selection through multiple signals:

* contrast
* slight material change
* possibly a small indicator
* text treatment
* subtle movement

Do not rely only on orange outlines.

Accessibility matters.

---

# 63. SHADOWS

Use broad, almost invisible depth.

Typical style:

```css
box-shadow:
  0 1px 2px rgba(24,24,24,.015),
  0 12px 40px rgba(24,24,24,.055);
```

Floating controls can have slightly more depth.

No chunky ecommerce shadows.

---

# 64. BORDERS

Use very few borders.

Where needed:

```css
border: 1px solid rgba(24,24,24,.055);
```

Hierarchy should come primarily from:

* type
* space
* surface
* shape
* depth

not boxes.

---

# 65. ICONOGRAPHY

Use the icon system already used in ScheduRx.

If Lucide remains the active system, preserve it.

Typical stroke:

```text
1.5–1.75
```

Do not introduce another icon package.

Keep icons thin and restrained.

---

# 66. ERROR STATES

Errors should look native to ScheduRx.

Example:

```text
That phone number doesn't look right.

Use a 10-digit Indian number.
```

Small restrained danger treatment.

Avoid giant red panels.

Server validation must still be authoritative.

---

# 67. SAVED / AUTOSAVE STATES

Autosave is useful but should not become visual noise.

A subtle status near the forward action is enough:

```text
Saved
```

or:

```text
Saving…
```

Do not show success toasts for every field.

---

# 68. LOADING STATES

Use warm skeletons consistent with the current app.

Avoid spinners all over the UI.

Google authentication may show an explicit progress state because it is a discrete action.

Uploads should show item-level progress when available.

---

# 69. EMPTY STATES

Use calm language.

For example, before adding awards:

```text
No awards added.

Add them if you'd like them shown
on your profile.
```

or simply:

```text
+ Add award
```

Do not add generic illustrations.

---

# 70. DESKTOP COMPOSITION

Desktop onboarding should not merely scale the mobile form to 900px wide.

Use intentional space.

Potential architecture:

```text
┌───────────────────────────────────────────────┐
│                                               │
│    Step / heading            form/context     │
│    atmospheric area          controls         │
│                                               │
└───────────────────────────────────────────────┘
```

or a constrained editorial column depending on the current app.

Possible widths:

```text
content max width ~1200–1400
form column ~520–680
```

Avoid stretching inputs across 1000px.

---

# 71. CONTROLLED ASYMMETRY

ScheduRx does not need everything centered.

Use:

* off-center atmospheric light
* asymmetric desktop columns
* slightly offset circular controls
* varied text widths

But maintain a real alignment grid underneath.

Do not create random floating UI.

---

# 72. NEGATIVE SPACE

Use more negative space than a typical onboarding flow.

Especially on:

* authentication
* practice selection
* role selection
* plan selection
* call forwarding
* completion

Screen 3 and 4 can naturally become denser, but still use progressive disclosure.

Do not fill every available vertical gap.

---

# 73. ONE SCREEN = ONE DOMINANT MOMENT

Before considering a screen finished, ask:

**What should the user's eye see first?**

For each:

Account → Google sign-in
Practice → Solo / Polyclinic
You → identity / role
Clinic → clinic identity
Plan → automation level
Calls → forwarding action
Team → invite/share

If the answer is unclear because eight things compete visually, redesign.

---

# 74. DESIGN THE DECISION, NOT THE DATABASE

The backend may have 25 fields.

The UI should not visually expose the database schema.

Example:

Backend may store:

```text
practice_type
workspace_role
clinic_id
owner_id
membership_role
```

The user only needs:

```text
How is your practice set up?
```

Design around human decisions.

---

# 75. DO NOT DISPLAY TECHNICAL TERMINOLOGY

Avoid surfacing implementation language such as:

```text
Workspace
Organization
Entitlement
Membership
Provider type
E.164
Telephony provisioning
Invitation token
```

unless the current product explicitly uses one of those terms.

Prefer:

```text
Clinic
Team
Plan
Doctor
Receptionist
Phone number
Invite code
```

---

# 76. COPY STYLE

Keep copy short and human.

Good:

```text
Set up your clinic
How do you practice?
Tell us about you
When do you usually work?
Now, your clinic
How much should ScheduRx automate?
Never miss a patient call
Bring your team
```

Bad:

```text
Please provide the following details pertaining to the organizational structure of your medical practice.
```

Do not sound corporate.

---

# 77. SCHEDURX BRAND PROMISE

The onboarding should subtly communicate:

**Your clinic, on autopilot.**

But do not repeat the slogan on every screen.

The product should demonstrate the idea through:

* prefilled information
* smart defaults
* quick copying of hours
* progressive disclosure
* inherited clinic settings for invited users
* plan recommendations
* simple telephony setup
* immediate invite/share actions

The onboarding itself should feel automated.

---

# 78. SMART DEFAULTS SHOULD BE VISIBLE

Whenever the system can save the user work, do it.

Examples:

* Google name already filled
* Google email locked
* common schedule copied to selected days
* `+91` already present
* INR already implied
* Asia/Kolkata already selected
* clinic defaults inherited by invited doctors
* Solo invite defaults to Receptionist
* most relevant plan visually recommended

Do not make doctors configure information ScheduRx already knows.

---

# 79. INVITED USERS SHOULD FEEL RECOGNIZED

An invited receptionist should not see:

```text
Step 1 of 7
Choose your practice type.
```

They should see:

```text
You're joining
Gupta Heart Clinic.

Let's set up your profile.
```

This is both better product logic and better design.

Do not rigidly force the seven-screen visual sequence onto invite users.

---

# 80. ACCESSIBILITY

Production usability wins over visual references.

Ensure:

* adequate contrast
* semantic headings
* correct form labels
* keyboard access
* focus-visible states
* `aria` for collapsible sections
* non-color-only selected states
* 44px minimum touch targets
* usable error messaging
* reduced-motion support

If a beautiful low-contrast treatment is inaccessible, correct the contrast while preserving the hierarchy.

---

# 81. REDUCED MOTION

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

Reduce:

* page translations
* glow changes
* spring movement
* atmospheric animation

State transitions must remain clear.

---

# 82. DARK MODE

If onboarding supports the existing dark mode automatically, do not treat it as an afterthought.

Use warm charcoal rather than blue-black.

The intended family is approximately:

```css
--dark-bg: #181818;
--dark-surface: #242321;
--dark-surface-soft: #302E2B;
```

with:

* warm white text
* restrained borders
* orange illumination

However, do not build an entirely separate onboarding theme system.

Use the application's current theme infrastructure.

---

# 83. NO GENERIC AI VISUALS

ScheduRx is AI-powered, but onboarding should not look like an AI startup landing page.

Do not introduce:

* rainbow orbs
* purple-blue gradients
* animated particles
* glowing neural networks
* sparkles everywhere
* “magic” icons on every field

If AI is referenced visually:

use:

```text
warm stone
+
orange illumination
+
charcoal/white
```

in the existing ScheduRx language.

---

# 84. NO GENERIC HEALTHCARE VISUALS

Do not add:

* green crosses
* heartbeat lines
* hospital-blue gradients
* stock doctors
* stethoscope illustrations
* medical icons everywhere

The product already communicates healthcare through its actual functionality.

---

# 85. NO STOCK IMAGERY

The onboarding does not need decorative doctor photos.

Use:

* actual Google avatar if available
* uploaded clinic/doctor media
* initials
* atmospheric materials

No unnecessary stock imagery.

---

# 86. NO ILLUSTRATION DEPENDENCY

Do not make the flow dependent on bespoke illustrations.

The visual system should be strong enough through:

* typography
* material
* spacing
* surfaces
* controls
* light

---

# 87. MOBILE KEYBOARD BEHAVIOR

Test keyboard interaction thoroughly for:

* invite code
* name
* phone
* bio
* qualifications
* clinic name
* address
* fees
* custom slot length
* invite sharing

Sticky bottom actions must not become inaccessible when the keyboard opens.

Avoid `100vh` traps.

Use dynamic viewport units appropriately.

---

# 88. LONG CONTENT

Test:

* long doctor names
* long clinic names
* long specialization names
* many qualifications
* five photos
* multiple breaks
* all seven working days
* five+ plan add-ons
* long address
* long invite clinic name

Do not let beautiful typography become fragile.

---

# 89. COMPONENT REUSE

Before creating new components, look for current ScheduRx equivalents.

Potential onboarding primitives may include:

```text
OnboardingShell
OnboardingProgress
LargeQuestion
CircleAction
PillAction
SoftField
IndiaPhoneField
MoneyField
ChoiceCard
RoleChoice
WeekdaySelector
WeeklySchedule
BreakRow
ProfilePhotoGrid
ExpandableSection
RepeatableProfileList
PlanCard
AddonRow
InviteSurface
ShareActions
CarrierChoice
StickyOnboardingAction
```

Names are flexible.

Do not build one gigantic `OnboardingForm.tsx`.

---

# 90. DO NOT OVER-ABSTRACT

The screens should still be compositionally expressive.

Do not make:

```tsx
<OnboardingScreen
  variant="doctor"
  fields={...}
  background="orange"
  columns={...}
  ...
/>
```

with 50 props.

Create reusable visual primitives, then compose screens deliberately.

---

# 91. RADIX / EXISTING PRIMITIVES

If Radix or other primitives exist, use them for behavior and accessibility.

But the final onboarding should not visibly resemble default Radix/shadcn UI.

The visible surface must be ScheduRx-authored.

---

# 92. VISUAL QA IS REQUIRED

Do not implement the onboarding entirely from code and assume it looks good.

Run the app.

Inspect it.

At minimum visually review:

```text
Screen 1 — Google Auth
Screen 2 — Practice selection
Screen 3 — Doctor profile collapsed
Screen 3 — Working hours expanded
Screen 4 — Clinic configuration
Screen 5 — Plan selection
Screen 5 — Build Your Own expanded
Screen 6 — Call forwarding
Screen 7 — Team invite
```

at:

```text
390 × 844
430 × 932
768 × 1024
1440 × 900
```

Perform at least one deliberate correction pass.

---

# 93. 390PX ACCEPTANCE TEST

At approximately 390px wide:

* no horizontal scrolling
* no clipped fields
* outer gutter feels intentional
* large headings have enough room
* progress remains subtle
* sticky CTA clears safe area
* day selector fits comfortably
* time fields remain usable
* photos remain manageable
* plan cards do not become tiny
* custom add-ons remain readable
* call-forwarding instruction is easy
* share actions have proper touch size
* keyboard does not hide critical controls
* nothing feels like compressed desktop UI

This size matters disproportionately.

---

# 94. SELF-CRITIQUE

Before calling the onboarding visually finished, ask on every screen:

### What is my eye supposed to see first?

If unclear, redesign.

### Does this look like the current ScheduRx?

If not, inspect the app again.

### Did I create unnecessary cards?

Remove them.

### Could typography replace a container?

Try it.

### Is orange overused?

Reduce it.

### Is the form intimidating?

Use progressive disclosure.

### Is this optimized for a busy doctor on their phone?

Simplify it.

### Would this screen look believable directly before the current ScheduRx Home screen?

If not, iterate.

---

# 95. CRITICAL TRANSITION TEST

The single most important visual continuity test is:

```text
Onboarding final screen
         ↓
ScheduRx Home
```

Take screenshots of both.

Put them side-by-side.

They should feel like consecutive moments in the same application.

There should be no obvious change in:

* typography
* palette
* radii
* surface philosophy
* icon treatment
* motion
* spacing
* quality
* visual personality

If onboarding looks like a website and Home looks like a native app, the task is not finished.

---

# 96. DO NOT MODIFY FUNCTIONAL LOGIC TO ACHIEVE A VISUAL EFFECT

All instructions in the main onboarding prompt concerning:

* Google authentication
* roles
* clinic structure
* availability
* calendar blocking
* clinic hours
* subscriptions
* credits
* call forwarding
* invitations
* permissions
* persistence
* security
* validation

remain authoritative.

This design appendix governs **presentation and interaction quality**.

Do not compromise business logic to mimic a visual reference.

---

# 97. FINAL VISUAL FORMULA

Whenever uncertain, return to this:

```text
OFF-WHITE CANVAS
+
WARM STONE
+
CHARCOAL
+
ONE VIVID ORANGE
+
LARGE LIGHT TYPOGRAPHY
+
SOFT ATMOSPHERIC LIGHT
+
OVERSIZED ROUNDED GEOMETRY
+
CIRCULAR ACTIONS
+
THIN ICONOGRAPHY
+
MINIMAL BORDERS
+
DELIBERATE GLASS
+
LARGE NEGATIVE SPACE
+
ONE DOMINANT MOMENT PER SCREEN
```

---

# 98. FINAL PRODUCT FORMULA

For onboarding specifically:

```text
one human decision
>
all underlying configuration
```

The doctor should never feel like they are configuring enterprise software.

ScheduRx should do as much of the thinking as possible.

---

# 99. FINAL INSTRUCTION

Do not merely make the onboarding “clean.”

Do not merely reuse the same Card component seven times.

Do not build a functional form first and leave visual refinement for later.

**Art-direct the onboarding as carefully as the main ScheduRx application has already been art-directed.**

Start by understanding the existing redesigned application.

Extract its real implemented design language.

Reuse its components and tokens.

Extend them only when necessary.

Then create an onboarding experience where:

* Google authentication feels effortless,
* Solo vs Polyclinic feels immediately understandable,
* doctor-profile entry feels editorial rather than bureaucratic,
* working-hours setup feels tactile,
* clinic configuration feels manageable,
* pricing feels premium and comprehensible,
* call-forwarding setup feels almost trivial,
* team invitation feels human,
* and entering the ScheduRx dashboard feels like a completely seamless continuation.

The result should make someone believe:

> **this onboarding was always part of ScheduRx.**

Do not design it as an attachment to the product.

**Design it as the opening chapter of the product.**
