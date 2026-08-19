# ScheduRx Platform — Backend Master Context
_Handoff doc for the backend/CTO. The frontend in this repo is fully functional against a mock store whose function signatures are the API contract. Replace internals, keep signatures._

## 1. Architecture at a glance
- **App**: Next.js 14 PWA (this repo). One codebase, two role shells (doctor / receptionist) resolved from session.
- **API**: Next.js route handlers (`app/api/*`) or a NestJS service — either works; contracts below.
- **DB**: Postgres via Prisma (`prisma/schema.prisma` is the source of truth).
- **Realtime**: one channel per clinic — `clinic:{id}` (Supabase Realtime / Pusher / Socket.io). Events: `queue.updated`, `now_serving.changed`, `thread.new_message`, `notif.new`, `appt.changed`.
- **AI services** (separate workers, queue-fed via BullMQ/SQS):
  1. **Voice agent** (calls): telephony (Exotel/Twilio IN) → STT → LLM w/ clinic tools (slots, book, reschedule) → TTS. Writes `CallLog`, `Appointment`, fires `notif.new` (critical keywords → `kind=CRITICAL`).
  2. **WhatsApp agent**: WA Business Cloud API webhooks → same tool loop. Writes `WaLog`, `Thread/Message` for text consults. Triage classifier stamps `Thread.triage`.
  3. **Consult capture**: audio chunks (ambient) or 15s recap → STT → structured note (SOAP-ish) → draft `Visit.note`, extract `followUpOn` when `settings.autoFollowUp`.
  4. **Recall engine** (cron, hourly): `Visit.followUpOn <= today && no future appt` → WA template → booking link → log to `WaLog(kind=FOLLOW_UP)`.
  5. **Review engine**: `Visit` completed + `Patient.review=NONE` → send review link after 2h → track via Google Business API → set `review=GIVEN`.

## 2. Frontend store contract → API mapping
`src/stores/index.ts` (`useClinic`) is the contract. Map 1:1:

| Store fn | Endpoint | Notes |
|---|---|---|
| `next()/prev()/jumpTo(id)` | `POST /api/queue/advance` `{direction|targetId}` | Server owns `state`+`position`; broadcast `now_serving.changed`. Prev = restore last DONE. |
| `reorderQueue(ids)` | `PATCH /api/queue/order` | Persist `position`; broadcast `queue.updated`. Last-write-wins is fine. |
| `addWalkIn({patientId,doctorId})` | `POST /api/queue/walk-in` | Upsert Patient by phone if new; create tentative Appointment(source=WALK_IN)+QueueItem. |
| `addAppointment(a)` | `POST /api/appointments` | If `pay=TOKEN` → create Razorpay link, status=TENTATIVE until webhook confirms. Video → create Meet link (Google Calendar API `conferenceData`). |
| `blockTime(docId,from,min,reason)` | `POST /api/calendar/block` | Return clashing appts; enqueue voice-agent reschedule calls for each; status→CANCELLED after patient picks new slot. |
| `setCapturing(bool)` | `POST /api/capture/start|stop` | Start streams audio (WebRTC/chunked upload) to capture worker. |
| `reply(threadId,text)` | `POST /api/threads/:id/messages` | Also mirrors to patient's WhatsApp. |
| `escalate(id)` | `POST /api/threads/:id/escalate` | Sets triage=CRITICAL + notif to doctor. |
| `markThreadRead / markNotifsRead` | `PATCH .../read` | |
| `addTask/toggleTask/removeTask` | `/api/tasks` CRUD | `due` → scheduled push via `PushSubscription`. |
| `setSetting(k,v)` | `PATCH /api/clinic/settings` | Owner-doctor only for `receptionAnalytics`, `billing`. |
| AI sheet commands | `POST /api/assistant` | LLM w/ tools: block_time, add_task, patient_history, next_free_slot. Frontend chips mirror these. |

## 3. Auth & tenancy
- OTP (MSG91) + Google OAuth. JWT session `{userId, clinicId, role}`.
- Every query scoped by `clinicId`. Role gates: receptionist blocked from `/analytics` (unless setting), `/billing` write, thread replies, settings.
- Patients are NOT users; they interact via WA/voice/web-booking (separate public storefront, not this app).

## 4. Realtime queue — the demo that sells
Two devices, one clinic: receptionist drags queue / taps ▸ → doctor's Now Serving card swaps live. In this repo it's simulated via `localStorage` storage-events across tabs (`(app)/layout.tsx`). Production: subscribe both clients to `clinic:{id}`, server is authority, optimistic UI + reconcile.

## 5. Notifications
- Web Push (VAPID) via `PushSubscription`. `sw.js` already handles `push` + click→`/consults`.
- CRITICAL triage → immediate push to doctor + top-of-inbox pin.

## 6. Prescriptions
- Photo: presigned S3 upload → `Visit.rxAttached/rxUrl` → WA to patient.
- Digital: `POST /api/prescription/:appointmentId` renders PDF server-side with `@react-pdf/renderer` (clinic letterhead: name, doctor, regNo) → S3 → WA. Route stub location per CTO spec: `app/api/prescription/[appointmentId]/route.ts`.

## 7. Compliance (India)
- DPDP Act: explicit consent for ambient recording (UI copy already says "with patient consent"); transcripts retention-limited; patient data resident in `ap-south-1`.
- Telemedicine Practice Guidelines 2020: digital Rx must carry doctor regNo + signature.

## 8. Env
`DATABASE_URL, REDIS_URL, RAZORPAY_*, WA_CLOUD_TOKEN, EXOTEL_*, GOOGLE_OAUTH_*, GOOGLE_CAL_SERVICE_JSON, OPENAI/ANTHROPIC key, VAPID_PUBLIC/PRIVATE, S3_*`
