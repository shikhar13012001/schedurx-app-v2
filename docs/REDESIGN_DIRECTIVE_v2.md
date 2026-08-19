# ScheduRx Platform — Redesign Directive v2
### For: Fable 5 · From: pilot doctor & peer review round 1
### Mission: Same feature set, radically calmer feel. Ship in one pass.

---

## 0. Read this first (the actual brief)

Every piece of feedback below traces back to one thing: **the app currently performs competence through density.** Doctors who don't live in software read "lots of information tightly packed" as "this will be hard," even when the feature underneath is simple. The fix is not removing features — it's **spatial confidence**: fewer things visible at once, generous air around each one, motion that reassures instead of decorates.

Build this like the calmest screen in iOS Health or a well-made banking app — not like a dashboard. You have full creative license on exact values, easing curves, and layout geometry. The constraints below are the *feel* you're building toward, not a spec to copy literally. Where you see an opportunity to make something more delightful than what's described, take it.

**Token-cautious execution note:** this is an edit pass on an existing, working Next.js 14 codebase (all routes, stores, and mock data already function correctly). Do NOT rewrite files from scratch. Read each file, make targeted edits (spacing classes, font tokens, component internals), and preserve every existing store/prop contract. Work in this order — each phase unlocks the next and most fixes are global find-and-replace on tokens, not per-page rewrites:

1. Typography + spacing tokens (global, cascades everywhere for free)
2. Motion primitives (page-swipe, orb, sheet springs — built once, used everywhere)
3. Light/dark surface polish (tokens, cascades everywhere)
4. Component-level fixes (chat bubbles, calendar timeline, video-call placement)
5. View-density toggle (Simple/Advanced) — do this last, it's additive
6. Pass over every screen for line-length, orphaned padding, alignment

Do not ask clarifying questions mid-build. Where this doc is ambiguous, make the more restrained, more spacious choice.

---

## 1. Typography — replace the display face entirely

Fraunces at these sizes reads as "legal document," not "modern clinic OS." Kill it as the primary display face.

**New pairing:**
- **Display / headings:** A clean modern grotesque with a touch of personality — reach for **Instrument Sans** or **General Sans** (both on Google Fonts / Fontshare, free, self-hostable). Avoid anything that reads as generic system UI (no plain Inter for headings) — pick one with slightly distinctive letterforms so the brand still has a signature, just not a costume-drama one.
- **Body / UI:** Keep **Geist Sans** — it's already correct, clean, corporate-modern, does the job.
- **Numbers (KPIs, prices, times):** Geist Mono or tabular-nums on the sans — never let digits jiggle in width.
- **The wordmark only** may keep a serif flourish (e.g. a lighter-weight Fraunces or swap to **Instrument Serif**) — used *only* in the logo, nowhere else. This preserves brand distinctiveness without making every h1 feel heavy.

**Scale correction** (current sizes are too tightly stepped and slightly too small for a "doesn't feel like software" reading):
- Page titles: 28–32px, weight 600, tight tracking (-0.02em) — but generous line-height (1.15+), never crammed against the element below.
- Section labels: keep uppercase micro-labels but lighten them — smaller (11px), lower opacity, more letter-spacing, so they read as *quiet* structure, not shouting.
- Body: bump base from 13–14px to **15–16px** across cards — doctors are often 40+, and slightly larger text reads as *considerate*, not unrefined.
- Reduce the number of distinct font sizes in view at once per screen — aim for 3 sizes max per screen (title / label / body), never 5–6 competing sizes.

---

## 2. Spacing system — give it air

Adopt a strict **8pt rhythm** and increase it wherever the current build undershoots:

- Card padding: `px-4 py-4` → `px-5 py-5` minimum, `px-6 py-6` for hero cards (Now Serving, overview).
- Vertical rhythm between stacked sections: `space-y-4` → `space-y-6` on Home/Calendar/Patients. Let sections breathe apart, not just the elements within them.
- **Kill card-in-card nesting.** Anywhere a `bg-surface-2` block sits inside a `Card` (symptoms panel inside Now Serving, AI note panel inside visit timeline) — flatten it. Use a left accent border + generous padding + no background fill instead of a second boxed surface. One level of container per screen region, never two.
- Corner radius: pull back slightly from the current very-rounded `1.125rem` cards — try **14–16px** on cards, **20px+** only on sheets/modals (bigger surfaces can carry bigger radius; small cards with big radius look toy-like and cramped at once, which is part of the "heavy" complaint).
- Icon-to-text gaps, badge padding, button heights: audit every `gap-1.5` that's doing double duty next to text — bump to `gap-2` / `gap-2.5` as a default.

**The real fix isn't "add padding everywhere" — it's reducing what's visible per screen** (see §5, Simple view) *and* giving what remains more room. Both together solve "overwhelming."

---

## 3. Motion system

### 3a. Swipe navigation — make it feel like Instagram
Current implementation detects a swipe threshold on touch-end and jump-navigates. Rebuild as a **live, finger-tracked transition**:
- Wrap the route content in a `motion.div` whose `x` is bound to the touch delta in real time during the gesture (not just on release) — the page should visibly slide under the finger, with a subtle scale/opacity shift on the incoming page, exactly like IG's tab-swipe or a card peeking in from the edge.
- On release: spring-settle to the next tab if past ~30% width or velocity threshold, otherwise spring back to origin (rubber-band, don't just snap).
- Apply consistent physics constants across this and the bottom-dock tab-pill transition so the whole nav system feels like one coherent material.

### 3b. The AI orb — this needs to feel alive, not decorative
Replace the spinning conic-gradient ring with a proper **liquid/glass orb** with distinct states:
- **Idle:** slow, organic blob morph (2–3 overlapping radial gradients drifting independently via CSS `@keyframes` on `border-radius` percentages or an SVG goo filter) — think Siri orb or a lava-lamp, not a spinning color wheel. Add a soft specular highlight that shifts subtly, like light on liquid glass.
- **Listening/live:** the blob should visibly *respond* — pulse amplitude tied to a fake or real audio level, or morph faster/more energetically. Bonus: a ring of small animated bars (voice-visualizer style) around the orb when actively capturing.
- **Thinking (between input and response):** a distinct third state — gentle shimmer sweep or slow single rotation, signaling "processing" vs "listening."
- **Tap/hold feedback:** a soft radial ripple emanating outward on press, spring-scale on the orb itself (not just opacity change).
- This orb pattern (idle/listening/thinking) should be one reusable component used identically in the bottom-dock center button, the AI sheet, and the Now Serving capture control — build it once, use everywhere.

### 3c. General motion polish
- Sheets: keep the spring but soften — reduce stiffness slightly so it settles instead of snapping, add a very subtle overshoot for warmth.
- List/card entrances: stagger children by ~30–40ms on page load (framer `staggerChildren`) instead of everything appearing at once — this alone makes a dense screen feel considered rather than dumped.
- Respect `prefers-reduced-motion` throughout (already partially handled — make sure new motion honors it too).

---

## 4. Calendar — add a real time axis

Rebuild the day view as a **vertical timeline**, not a flat list of cards:
- Fixed-width time gutter on the left (`7 AM`, `8 AM`, …) in muted, small, tabular type — sticky/aligned so the eye can scan straight down and instantly see gaps.
- Appointments render as blocks positioned proportionally to their time and duration (like Google Calendar / Cron / Fantastical), not as a uniform list — this is what makes "next free slot" visually obvious instead of requiring reading text.
- A live "now" indicator line (thin colored line + dot) crossing the timeline at the current time.
- Give rows real height — don't compress a 15-minute slot to the same visual height as a 2-hour block. Let empty time visually *look* empty (this is the single biggest fix for "layout feels tight" — right now every slot looks equally dense whether it's booked or free).
- Keep the existing week-strip and doctor-switcher above it, just give them more breathing margin from the timeline below.

---

## 5. Simple / Advanced view toggle

Add a persisted setting (`viewMode: "simple" | "advanced"`, default **simple**) with a small, unobtrusive toggle in Profile (and optionally a quick-access affordance near the top of Home).

**Simple (default):**
- Home: Now Serving + one-line queue status + 2–3 quick actions max. Today's Overview collapses to a single quiet strip ("3 left today, next free at 4:00") — tap to expand into Advanced-style detail inline, rather than showing KPIs by default.
- Analytics: KPI headline + Practice Pulse only; charts hidden behind an "See full analytics" tap-through.
- Patient profile: latest visit expanded, older visits collapsed into a simple list (tap to expand), instead of every visit's AI note panel open at once.

**Advanced:** everything currently built — full KPI grid, all charts, all visit notes expanded, nothing collapsed. This is where power users (or a doctor mid-review) go to see everything.

The toggle itself should animate the transition (height/opacity, not a hard re-render jump) so switching feels like breathing out, not reloading a page.

---

## 6. Video/online consultation — surface it properly

- **Home (doctor):** when a video/audio consult is starting within 15 minutes, promote it out of the generic list into a distinct, glass-surfaced banner near the top of the screen — patient name, countdown ("Starts in 6 min"), and a prominent pill-shaped **Join** button with a video icon. This should feel like an incoming-call affordance, not a list row.
- **Consults → Online tab:** redesign each entry as a proper call card — bigger avatar, countdown badge, mode icon, and a clearly primary Join/Call button (not a small text link). Group by "Starting soon" vs "Later today" instead of one flat chronological list.
- Once joined (or after the scheduled time passes), the card should visually deemphasize (fade/gray) rather than stay visually identical to upcoming ones.

---

## 7. Liquid glass — one clean, restrained application

Don't scatter glassmorphism everywhere — it reads as trendy noise if overused. Apply it deliberately to **surfaces that float above content**:
- Bottom dock (mobile) and desktop sidebar edge: `backdrop-filter: blur()` with a translucent surface tint — already partially there, push it further with a subtle inner highlight border (1px, low-opacity white/light line along the top edge) for that "frosted edge" look.
- Sheets/modals: frosted overlay behind them, and the sheet surface itself very slightly translucent with blur, especially in dark mode.
- The AI orb's core (§3b) — glass/liquid treatment lives here natively.
- Floating banners (the video-call countdown banner from §6) — this is a great candidate for a glass treatment since it's meant to feel like an overlay, not part of the page flow.
- **Do not** apply glass to standard content cards (patient list, appointment cards) — those should stay solid and legible. Glass = things that float; solid = things that are content.

---

## 8. Light mode — make it feel finished

- Soften the background: current `--bg` off-whites can feel flat/cheap at scale. Reduce contrast slightly between `bg` and `surface`, and introduce a very subtle warm or cool tint (matching each theme's hue) rather than a neutral gray-white, so it reads considered rather than default.
- Shadows: replace hard/small card shadows with **larger, softer, lower-opacity** shadows, ideally tinted toward the theme's primary color rather than pure black — this is what makes Apple-style light mode look premium instead of flat.
- Border contrast: current borders can look slightly harsh on light backgrounds — soften opacity, let separation come more from shadow/spacing than hard lines where possible.
- Badges/pills: soften saturation slightly across all tone colors in light mode specifically — the current soft-tones are good in principle, just push them 5–10% lighter/quieter in light mode.

---

## 9. Consult chat — make it feel like WhatsApp, not a form

Full rebuild of the thread view's message rendering:
- Remove the bordered-card treatment on messages entirely. Use true chat bubbles: patient messages left-aligned with a tail, doctor messages right-aligned in the primary color with a tail, both with generous internal padding and a soft shadow instead of a border.
- AI messages: small circular AI avatar/icon beside a distinctly (but not jarringly) tinted bubble — still a bubble, just visually flagged as "not the patient," the way WhatsApp Business shows automated replies.
- Add a subtle background texture or tint to the whole chat canvas (not stark white/surface) — WhatsApp's dotted/patterned background is doing real work making the thread feel like a *conversation space*, not a document.
- Day dividers ("Today," "Yesterday") as small centered pills between message groups.
- Timestamp: small, muted, inline at the bottom-right corner of each bubble (or bubble cluster) rather than a separate line — this is a big part of what makes it read as chat vs. form.
- Input bar: pill-shaped, with the send button morphing from a mic icon to an arrow depending on whether there's text — small detail, high familiarity payoff.

---

## 10. Additional polish worth doing while you're in each file

- **Empty states:** give them a touch more warmth — a softly animated icon (gentle float/pulse) rather than a static line-art glyph.
- **Skeleton loaders:** anywhere data "loads" (even mock/instant), a brief skeleton shimmer prevents jarring pop-in and reinforces the calm, considered feel.
- **Haptic-style press feedback:** ensure every tappable surface has a consistent `active:scale-[0.97]` or similar — audit for consistency, several components currently skip this.
- **Consistent icon stroke width** across all Lucide icons (pick 1.75–2 and apply everywhere; mixed weights currently make icons feel slightly inconsistent).
- **Pull-to-refresh** on the queue list — small but reinforces "this is a living, responsive app."

---

## 11. QA pass before calling it done

- [ ] No screen shows more than 3 distinct font sizes at once
- [ ] Every card has ≥ 20px internal padding; no card-in-card nesting remains
- [ ] Swipe transitions visibly track the finger in real time, not just on release
- [ ] AI orb has 3 distinct visual states (idle/listening/thinking), reused identically in all 3 locations it appears
- [ ] Calendar shows a visible time axis with proportional appointment blocks and a live "now" line
- [ ] Simple view is the default and visibly shows less than Advanced view on Home, Analytics, and Patient profile
- [ ] Upcoming video/audio consults are visually distinct from a plain list row, both on Home and in Consults
- [ ] Chat threads render as bubbles with tails, no borders, timestamp inline
- [ ] Light mode shadows are soft, tinted, and larger than before — no hard-edged card shadows remain
- [ ] Glass treatment appears only on floating/overlay surfaces, never on standard content cards
- [ ] `prefers-reduced-motion` is respected by every new animation added
- [ ] `npm run build` passes clean with zero type errors before delivery

Build it beautifully. You have room to be bolder than this doc anywhere it's silent — the goal is a doctor opening this for the first time and feeling like the software is looking after *them*, not asking something of them.
