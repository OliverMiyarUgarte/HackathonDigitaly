# What changed and why

Running note for the team and for the "Entendimento do código" evaluation criterion. It
groups the work by theme, states the user-visible impact, and points at the commit subjects
so anyone can trace a feature back to the code and the reasoning. Commit hashes are from
`git log --oneline` on `main`.

**How to use this in the demo:** pick the theme you own, explain what it does, why it
exists, what the AI generated, and what you personally reviewed or changed. See the
[AI generation](#what-the-ai-generated-vs-what-humans-decided) section for the honest
version of that story.

Baseline: NestJS 11, Prisma 7.10 (`@prisma/adapter-pg`), PostgreSQL 16, Next.js 16 App Router
and FastAPI. Verified tests: API **24 unit suites / 169 tests**, API **13 e2e suites / 78
tests**, web **25 Playwright tests**, AI **39 pytest tests**.

---

## Contracts — one source of truth for every payload

**Why:** web, API and AI must agree on every REST body, WebSocket event and AI frame, or the
system breaks silently at the boundaries. Putting the shapes in one package makes a payload
change a deliberate, reviewable event.

**User-visible impact:** the API, the browser and the copilot speak the same field names and
enums; errors and events are consistent across services.

**Backend evidence:** `service-contracts/types/` (REST DTOs and enum constants),
`service-contracts/events/` (`ClientToServerEvents`, `ServerToClientEvents`,
`AiClientFrame`, `AiServerFrame`), `service-contracts/http/openapi.yaml` (OpenAPI 3.1),
`service-contracts/python/contracts.py` (handwritten Pydantic v2 mirror), semver rules and
`service-contracts/CHANGELOG.md`. NestJS DTO classes `implements` the contract types and
adds `class-validator`; no `any` in the shared contracts.

**Commits**
- `313d611` feat(contracts): add shared HTTP, WebSocket and AI payload contracts
- `f1a5892` build(contracts): ship compiled types for local package consumers
- `dd3fa51` fix(contracts): implement users endpoints and align health, config and docs

---

## Data layer — schema, migration and fictional seed

**Why:** a single relational model for users, appointments, codes, consultations, records,
attachments and audit; UUID keys, timestamptz and indexes that match the calendar/agenda
queries. The seed makes the demo deterministic and reproducible.

**User-visible impact:** the demo always starts from a known state (2 doctors, 2 patients,
upcoming and completed appointments, a medical record with pre-consult answers).

**Backend evidence:** `prisma/schema.prisma` (9 models), `prisma/migrations/20260912161334_init`,
`prisma/seed.ts` (fictional `Demo@1234` accounts and fixed UUIDs), `prisma.config.ts`
(`tsx prisma/seed.ts`). Indexes cover `doctorId+scheduledAt`, `patientId+scheduledAt desc`,
`status`, `appointmentId+expiresAt`, `resourceType+resourceId` and `actorId+createdAt`.

**Commits**
- `c6a6047` feat(db): add Prisma schema, initial migration and fictional seed
- `9ea6c4d` chore(infra): add isolated dev Postgres, MailHog and Adminer stack

---

## Auth — JWT, refresh rotation and role guards

**Why:** patients and doctors need different capabilities, and refresh tokens must be
revocable without a signing-secret rotation.

**User-visible impact:** secure login with a short-lived access token; a stolen/replayed
refresh token revokes the whole token family instead of silently working. Doctor
self-registration is off by default.

**Backend evidence:** `auth.service.ts` + `token.service.ts` (argon2id passwords, access JWT,
opaque 256-bit refresh tokens stored as SHA-256, atomic rotation, reuse detection),
`common/guards/jwt-auth.guard.ts`, `common/guards/roles.guard.ts` with the global providers
in `app.module.ts`, `@Public()` on the health/login routes, throttling on auth routes, and
`ALLOW_DOCTOR_SELF_REGISTRATION`.

**Commits**
- `7ec1405` feat(auth): add register, login, refresh and logout with JWT and role guards
- `e0569cc` fix(auth): harden refresh rotation, booking races and OTP handling
- `dd3fa51` fix(contracts): implement users endpoints and align health, config and docs

---

## Booking + OTP — race-safe scheduling and e-mail confirmation

**Why:** double-booking and OTP brute force are the two obvious failure modes of a
telemedicine scheduler. Confirmation by e-mail also proves the patient owns the address.

**User-visible impact:** a chosen slot is either granted or rejected with `409 SLOT_TAKEN`,
never duplicated; a 6-digit code arrives by e-mail and expires; wrong codes are rate-limited
and only a generic "invalid or expired" message is returned.

**Backend evidence:** `appointments/slots.service.ts` (weekday 09:00–17:00, 30-minute slots,
≤ 31 days), `appointments.service.ts` (`pg_advisory_xact_lock` + overlap check inside a
transaction, pre-consult at booking), `validation-code.service.ts` (CSPRNG code, HMAC-SHA256
with `OTP_PEPPER`, per-appointment expiry, single-use, attempt cap across reissues,
`timingSafeEqual`), `mail/mail.service.ts` (Nodemailer, pt-BR text + HTML, generic 503 on
failure, never logs the code).

**Commits**
- `e3ab768` feat(appointments): add booking, availability, calendar and doctor listing
- `28e93d2` feat(appointments): confirm bookings with e-mailed validation codes
- `f795b7b` feat(mail): add Nodemailer transactional mail for validation codes
- `e0569cc` fix(auth): harden refresh rotation, booking races and OTP handling

---

## Realtime — authenticated Socket.IO and WebRTC signaling

**Why:** video and notifications need a persistent channel, but it must be authenticated and
scoped to the people in the appointment. Notifications must also reach a user who is not
yet in the room.

**User-visible impact:** the patient gets "the doctor started" even before joining; both
sides exchange offers/answers/ICE; presence (joined/left) and mic/camera state are visible.

**Backend evidence:** `realtime/realtime.gateway.ts` (JWT handshake from `auth.token` or
`Authorization: Bearer`, invalid handshakes disconnected, appointment rooms + per-user rooms,
access check on `room.join`, relay of `webrtc.offer/answer/ice` and `media.state`),
`realtime/realtime.service.ts` (in-memory presence, ICE servers built from `STUN_URLS` /
`TURN_URLS`), event maps in `service-contracts/events/websocket-events.ts`. SDP and tokens
are never logged.

**Commits**
- `c6ac953` feat(realtime): add authenticated Socket.IO gateway and WebRTC signaling

---

## Consultations — lifecycle, notification and session setup

**Why:** starting a consult must atomically create the consultation and flip the appointment
to `in_progress`, then tell the patient and give the browser the ICE servers it needs.

**User-visible impact:** a confirmed appointment can be started exactly once; the patient is
notified in real time; ending the consult completes both consultation and appointment.

**Backend evidence:** `consultations/consultations.service.ts` (doctor ownership + confirmed
status + single-consultation guards, transactional start/end, `consultation.started` emitted
to both the appointment room and the patient's user room, `consultation.ended` on end),
`consultations.controller.ts` (`/api/consultations/mine` history with doctor counterpart and
diagnosis), `StartConsultationResponseDto` with `roomId`, `iceServers`, `participants`.

**Commits**
- `bfe545f` feat(consultations): start and end teleconsultations with realtime notification

---

## Records — pre-consult, patient overview and medical records

**Why:** the doctor needs context before the call, and the legally relevant output of the
consult is the medical record. Reads must be scoped so a doctor only sees linked patients.

**User-visible impact:** the doctor sees profile, upcoming appointment, recent history and
pre-consult in one payload; the patient can maintain pre-consult answers until the consult
is terminal; records are doctor-authored, one per consultation.

**Backend evidence:** `records/records.service.ts` (upsert + de-duplicate pre-consult by
question key, `PatientOverviewDto` aggregation, `EDITABLE_STATUSES = pending_code|confirmed`,
one record per consultation with `RECORD_EXISTS`, role-scoped `findOne` and `getHistory`),
`appointments/appointment-access.service.ts` (`assertPatientAccess` requires a non-cancelled
appointment link).

**Commits**
- `6d2853b` feat(records): add pre-consult answers, patient overview and medical records

---

## Attachments — upload and streaming download

**Why:** consultations need documents and images, but PHI must not be exposed on a public
path or via a naive filename.

**User-visible impact:** participants can upload a PDF/PNG/JPEG/WebP/TXT up to 10 MiB and
download the original bytes; unsupported or oversized files get clear 415/413 errors.

**Backend evidence:** `attachments/attachments.service.ts` (participant check, allowlist,
server-classified `kind`, compensating delete if the DB insert fails),
`attachments/storage/local-storage.service.ts` (traversal-safe `basename`/`relative` check
under `UPLOAD_DIR`), `attachments.controller.ts` (streams with stored `Content-Type`,
`Content-Disposition: inline` and `X-Content-Type-Options: nosniff`). The `StorageService`
abstraction is the seam for an object-store driver.

**Commits**
- `b6bfcfb` feat(attachments): add appointment file upload and download on local disk

---

## AI proxy — streamed audio and doctor-only feedback

**Why:** the copilot should not be reachable from the browser with an internal token, and a
failed copilot must never break a consultation.

**User-visible impact:** the doctor sees live `transcript.partial` / `transcript.final` and
`copilot.feedback`; the patient never receives them. If the AI is down, the doctor sees
`ai.status: unavailable` and the call continues.

**Backend evidence:** `ai/ai-proxy.service.ts` (HTTP `POST /sessions` with
`X-Internal-Token`, WS `/sessions/{id}/audio`, 2s timeouts, 64-frame buffer, doctor-only
`getAuthorizedSession`, graceful `connecting|ready|unavailable` status),
`realtime/audio-frame-handler.ts` decouples the gateway from the AI module,
`consultations.service.ts` opens/closes the session around the consult lifecycle.

**Commits**
- `c54eedd` feat(ai): proxy consultation audio to the Python copilot and relay feedback

---

## Ops — bootstrap, errors, readiness and deployment

**Why:** a demo and a deployment need predictable startup, a consistent error shape,
correlation ids for debugging, and probes that distinguish "alive" from "can serve".

**User-visible impact:** consistent `ErrorResponseDto` with a `correlationId`, Swagger at
`/docs`, `/api/health` liveness, `/api/ready` readiness, and a containerized run.

**Backend evidence:** `main.ts` (global prefix `/api`, `ValidationPipe` with
`whitelist`/`forbidNonWhitelisted`/`transform`, CORS allow-list, Swagger),
`common/filters/http-exception.filter.ts`, `common/interceptors/correlation-id.interceptor.ts`
and `logging.interceptor.ts`, `app.module.ts` (Joi env validation, throttling),
`health/readiness.service.ts` (Postgres + AI; DB down → 503, AI down → 200 degraded),
`Dockerfile` (multi-stage, non-root, healthcheck), `docker-compose.yml`, and
`docs/operations.md` (topology, observability, secrets, LGPD retention).

**Commits**
- `2766280` chore(api): bootstrap NestJS service with config, validation, health and Swagger
- `d8d1488` feat(api): add contract error responses, correlation ids and request logging
- `8950a9d` feat(ops): add readiness checks, container image and production topology notes
- `9ea6c4d` chore(infra): add isolated dev Postgres, MailHog and Adminer stack

---

## Hardening — fixes found while reviewing the generated code

**Why:** the first pass of generated code worked on the happy path but had races and edge
cases. This is the review layer that makes the demo trustworthy.

**User-visible impact:** no double bookings, no refresh-token replay, doctor registration
locked down, scoped patient access, OTP attempts can't be reset by reissuing, and clean
shutdown on SIGTERM.

**Backend evidence:** `e0569cc` (atomic refresh rotation + token-family revocation,
`pg_advisory_xact_lock`, non-cancelled patient link, attempt cap across reissues,
`EMAIL_TAKEN` on register races, stream/socket error handling, SIGTERM hooks,
route-template logging), `5cb8c98` (e2e `--runInBand` to remove shared-DB flakiness),
`dd3fa51` (users module, health shape alignment, `JWT_REFRESH_SECRET` removal, local-only
host binding).

**Commits**
- `e0569cc` fix(auth): harden refresh rotation, booking races and OTP handling
- `dd3fa51` fix(contracts): implement users endpoints and align health, config and docs
- `5cb8c98` test(e2e): run suites serially to avoid shared-database races

---

## Audit — append-only access trail

**Why:** LGPD accountability requires being able to demonstrate who accessed or changed
sensitive resources. The audit must never store the sensitive content itself.

**User-visible impact:** logins, refresh reuse, appointment create/confirm/cancel and code
request/verify, consultation start/end, medical-record create/read, patient overview read,
consultation history read, and attachment upload/download all produce one audit row.
Audit write failures never break a request.

**Backend evidence:** `common/audit/audit.service.ts` (action convention
`<domain>.<entity>.<verb>`, `outcome: success|denied`, `metadata` limited to outcome +
correlation id, sensitive keys and e-mail-like values dropped, constant failure log),
`RequestContextService` (AsyncLocalStorage) feeding correlation id, action list in
`docs/operations.md` §4.

**Commits**
- `3d5a460` feat(audit): record access to sensitive resources

---

## Dependencies — advisory patches

**Why:** generated dependency trees can carry known advisories; the runtime should be clean.

**User-visible impact:** none directly; a safer runtime.

**Evidence:** `Backend/package.json` pins `overrides.multer` to `^2.3.0` and `nodemailer`
9.1.1. The remaining advisories are Prisma CLI tooling not loaded by the Postgres runtime.

**Commits**
- `71ca0cf` chore(deps): patch multer and nodemailer advisories

---

## Users — the module that made the contracts real

**Why:** the original contract documented user endpoints but the module did not exist yet;
this commit closed the producer/consumer gap.

**User-visible impact:** profile read/update, a doctor directory with specialty/name filters,
and a scoped patient lookup for doctors.

**Backend evidence:** `users/users.service.ts` and `users.controller.ts`,
`AppointmentAccessService.assertPatientAccess`, and the OpenAPI alignment in `dd3fa51`.

**Commits**
- `dd3fa51` fix(contracts): implement users endpoints and align health, config and docs

---

## Integration — turning the API, web and AI into one platform

**Why:** the first milestone proved the API and its contracts. The second milestone made the
whole path real in the browser and rewrote the Python service to the same contract, so the
demo runs end to end instead of being described by intent. The database was cleaned up and a
single-VPS production stack was added at the same time.

**User-visible impact:** a patient can now log in at `/entrar`, book and confirm a
consultation in the web app, see it on the calendar, and join the video room; the doctor can
filter the agenda, read the pre-consult, start the consult with one click, see the patient
notified in real time, stream microphone PCM to the copilot, end the call and write the
record — all against the same seed. In production, one Compose command brings up web, API,
AI, database and Caddy with automatic TLS and migrations.

**What was integrated**

- **Web rebuilt on the Digitaly design system** (`f08fb59`, `4d9ebe1`): Next.js 16 App
  Router routes under `front-end/app/` — `/entrar`, `/registro`, `/recuperar-senha`,
  `/paciente`, `/paciente/agendar`, `/paciente/confirmar-agendamento`,
  `/paciente/calendario`, `/paciente/historico`, `/paciente/prontuario`,
  `/paciente/consultas/[id]`, `/medico`, `/medico/atendimentos`,
  `/medico/pacientes/[id]`, `/medico/consultas/[id]`, `/medico/consultas/[id]/fechamento`,
  `/medico/prontuario`. Tokens from `docs/design-system.md` live in
  `front-end/app/globals.css`; the component library is under `front-end/components/ui`.
  Legacy `/auth/*` and `/dashboard` paths redirect to the new routes.
- **Patient journey** (`e8c0bf6`): four-step booking wizard (doctor, slot, pre-consult,
  summary), automatic code request, MailHog deep link, code verification with countdown and
  attempt feedback, calendar with cancel/confirm actions.
- **Doctor journey** (`05aa82d`): filterable agenda, patient overview aggregating profile,
  upcoming appointment, pre-consult and history, start/end actions with confirmation dialogs,
  and the closing form.
- **Realtime room** (`abb53ee`): WebRTC offer/answer/ICE over the authenticated socket,
  in-memory presence, mic/camera/fullscreen/attachment controls, the copilot panel, and the
  browser PCM encoder (`pcm_s16le`, 16 kHz, mono) with a worklet.
- **Python rewritten to the contract** (`5e7ba0d`, `bb112f3`): FastAPI service with
  `/health`, `POST /sessions` and the `/sessions/{id}/audio` WebSocket; `FakeTranscriber` +
  `RuleCopilot` for offline demos, optional Whisper local STT and OpenAI LLM; Pydantic
  models mirror `service-contracts`. The old `Transcrever.py`/`mock_backend.py` prototype was
  removed.
- **Database cleanup** (`025ddfa`): indexes aligned with the calendar/agenda queries, the
  broken prototype SQL dumps moved to `docs/legacy/` and a generated
  `docs/schema.reference.sql` kept as the read-only snapshot.
- **Deploy stack** (`9a4f895`, `8324903`): `docker-compose.prod.yml` with `web`, `api`,
  `ai`, `db` and Caddy `proxy`, an API entrypoint that waits for Postgres and runs
  `prisma migrate deploy`, the one-shot `seed` and `backup` profiles, per-service env
  injection, container hardening (non-root, read-only rootfs, `cap_drop: ALL`) and a Caddy
  CSP/HSTS configuration.
- **Reviews and fixes** (`04c649d`, `68b7844`, `37756d9`, `bb112f3`): trusted proxy
  handling, OTP attempt accounting, broader audit coverage and socket rate limits; resilient
  session refresh and audio resume in the web app; Nielsen heuristics, accessibility
  (single `h1`, focus-trapped dialogs, `aria-live` notifications, no overflow at 375px) and
  design conformance verified by the Playwright polish suite; audio frame types aligned with
  the contract.

**Commits**
- `f08fb59` feat(web): rebuild the frontend on the Digitaly design system
- `4d9ebe1` docs: vendor the Digitaly design system for the frontend overhaul
- `e8c0bf6` feat(web): implement the patient booking and consultation journey
- `05aa82d` feat(web): implement the doctor agenda and consultation closing journey
- `abb53ee` feat(web): add realtime consultation room with WebRTC and copilot streams
- `37756d9` polish(web): apply Nielsen heuristics, accessibility and design conformance
- `68b7844` fix(web): make session refresh resilient and harden audio resume
- `5e7ba0d` fix(ai): rewrite the copilot as a contract-compliant FastAPI service
- `bb112f3` fix(ai): align audio frame types and document local whisper setup
- `025ddfa` fix(db): align indexes with query patterns and retire broken legacy dumps
- `9a4f895` feat(deploy): add a single-VPS production stack with Caddy and migrations
- `04c649d` fix(api): harden proxy trust, OTP attempts, audit coverage and realtime limits
- `8324903` fix(deploy): tighten CSP, harden containers and correct the runbook

---

## What the AI generated vs what humans decided

Be direct about this — reviewers reward understanding over a claim that everything was
hand-written.

- **AI-generated:** the bulk of the implementation, commit by commit: module scaffolding,
  DTOs, services, controllers, Prisma schema and seed, tests, Docker/compose, and the first
  draft of the docs.
- **Human-decided:** the service boundaries, the contract-first rule and the shape of the
  shared package, the security requirements (OTP hashing, refresh rotation, role scoping,
  no PII in logs), the LGPD posture, the demo narrative and the choice to keep the AI
  copilot optional.
- **Human-reviewed / AI-fixed:** follow-up commits fixed real defects the review surfaced
  (`e0569cc` races and token reuse, `dd3fa51` contract/health alignment and local binding,
  `3d5a460` audit, `71ca0cf` advisories) and made the e2e run deterministic (`5cb8c98`).

**Per-theme prompt to each owner:** "I understand this module because I can explain [the
data flow], [why the constraint exists], and [what we changed after review]." Pick one
theme from this document and be ready to point at the file and the commit.

**Suggested 20-second closing line:** "The AI wrote most of the code. We wrote the
contracts, the security model and the demo, and we reviewed and hardened every commit —
`docs/what-changed.md` maps each theme to the commits so you can check our understanding."
