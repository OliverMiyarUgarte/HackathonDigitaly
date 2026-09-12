# Digitaly Telemedicine

A teleconsultation MVP for Brazil: patients book a specialist, confirm the slot with a
code sent by e-mail, and meet the doctor in a video room with an AI copilot that streams
transcription and real-time feedback to the clinician.

The problem: access to specialists is slow, and booking, confirmation, the consultation
itself and the medical record live in disconnected tools. Digitaly puts the whole path in
one platform with a single, shared contract between services.

> **Scope of this repository.** The full product is four services (web, API, AI copilot,
> PostgreSQL). This repository currently contains the **NestJS API** and the shared
> **`@telemed/service-contracts`** package. The Next.js web app and the Python FastAPI AI
> copilot are built and deployed as separate services; this API exposes the contracts they
> consume. Everything documented as "verified" below was checked against the code in this
> repository.

---

## End-to-end demo path

1. **Patient** registers/logs in, picks a doctor and a weekday 30-minute slot, and answers
   the pre-consult questions.
2. The booking is created as `pending_code`; the patient requests a **6-digit e-mail code**
   and reads it in MailHog.
3. Confirming the code moves the appointment to `confirmed`; the patient calendar shows it.
4. **Doctor** logs in, sees the agenda with the pre-consult flag, reviews the patient
   overview (profile, upcoming appointment, history, pre-consult) and starts the
   teleconsultation.
5. The **patient receives a real-time notification** on the `/realtime` Socket.IO
   namespace and joins the video room; WebRTC offer/answer/ICE is relayed through the API.
6. The doctor attaches a file; the browser streams audio frames to the API, which proxies
   them to the Python copilot and relays `transcript.partial`, `transcript.final` and
   `copilot.feedback` back **to the doctor only**.
7. The doctor ends the consultation (appointment becomes `completed`) and writes the
   medical record.

See [`docs/demo-script.md`](docs/demo-script.md) for the timed presentation script and
[`docs/operations.md`](docs/operations.md) for operations, production topology and LGPD.

---

## Architecture

Target platform (services in boxes marked `*` live in this repository today):

```text
            +-----------------------------------------------+
            |              Browser (patient / doctor)        |
            |        Next.js web *            WebRTC media   |
            +-----------------------+-----------------------+
                                    |  HTTPS / WSS
                    +---------------v----------------+
                    |  NestJS API *                  |
                    |  auth, scheduling, records,    |
                    |  WebSocket gateway, mail,      |
                    |  AI proxy                      |
                    +--+----------+-------------+-----+
                       |          |             |
          Prisma       |          | SMTP        | HTTP + WS
          (driver-pg)  |          |             | (X-Internal-Token)
                       v          v             v
              +-------------+ +--------+  +--------------------+
              | PostgreSQL  | | MailHog|  | FastAPI AI copilot |
              | users,      | | (dev)  |  | STT + feedback     |
              | appointments| +--------+  +--------------------+
              | records *   |
              +-------------+
                       ^
                       |  on-disk / future object store
              +--------+---------+
              | Attachments      |
              +------------------+

            shared @telemed/service-contracts * (REST DTOs, OpenAPI,
            Socket.IO event maps, Nest <-> Python AI frames)
```

Key properties:

- **Modular monolith API.** One NestJS process with clear domain modules — `auth`,
  `users`, `appointments`, `consultations`, `records`, `attachments`, `realtime`, `ai`,
  `mail`, `health`, plus cross-cutting `common` (guards, filters, interceptors, audit).
  Global `JwtAuthGuard` and `RolesGuard` are registered app-wide: every route requires
  authentication unless explicitly marked `@Public()`, and routes annotated with
  `@Roles(...)` are restricted to that role.
- **Contracts first.** Every HTTP body, WebSocket event and Nest↔Python frame is defined
  once in `@telemed/service-contracts` (TypeScript types, OpenAPI 3.1, Pydantic v2
  mirror). Producers and consumers both import it; the package has its own semver and
  [`CHANGELOG.md`](service-contracts/CHANGELOG.md).
- **PostgreSQL** stores users, refresh tokens (hashed), appointments, hashed validation
  codes, consultations, medical records, pre-consult answers, attachments (metadata) and
  an append-only audit log, via Prisma 7 with the `@prisma/adapter-pg` driver adapter.
- **Real-time** runs on a JWT-authenticated Socket.IO namespace `/realtime`, with
  per-appointment rooms and per-user rooms for notifications.
- **AI is optional by design.** If the copilot is unreachable, readiness reports
  `degraded` and the doctor gets `ai.status: "unavailable"`; the consultation still works.

---

## Repository layout

```text
HackathonDigitaly/
├── Backend/                     # NestJS 11 API (this repo's service)
│   ├── prisma/
│   │   ├── schema.prisma        # 9 models, enums aligned with the contracts
│   │   ├── migrations/          # initial migration
│   │   └── seed.ts              # fictional demo users and appointments
│   ├── src/
│   │   ├── auth/                # register, login, refresh, logout (JWT + argon2id)
│   │   ├── users/               # me, doctor directory, scoped patient lookup
│   │   ├── appointments/        # slots, booking, OTP confirmation, calendar, agenda
│   │   ├── consultations/       # start/end, WebRTC session setup, history
│   │   ├── records/             # pre-consult, patient overview, medical records
│   │   ├── attachments/         # upload/download + local storage driver
│   │   ├── realtime/            # Socket.IO gateway, rooms, presence, signaling
│   │   ├── ai/                  # HTTP/WS proxy to the Python copilot
│   │   ├── mail/                # Nodemailer validation-code e-mails
│   │   ├── health/              # liveness + readiness
│   │   ├── common/              # guards, filters, interceptors, audit, context
│   │   └── generated/prisma/    # generated client (not committed)
│   ├── test/                    # 13 e2e suites (serial, needs PostgreSQL)
│   ├── docker-compose.yml       # tmp Postgres, MailHog, Adminer, API
│   ├── Dockerfile               # multi-stage, non-root runtime
│   └── README.md                # backend-specific guide
├── service-contracts/           # @telemed/service-contracts
│   ├── types/                   # REST DTOs and enums
│   ├── events/                  # Socket.IO event maps, Nest↔Python frames
│   ├── http/openapi.yaml        # OpenAPI 3.1 (global prefix /api)
│   ├── python/contracts.py      # handwritten Pydantic v2 mirror
│   └── CHANGELOG.md             # contract semver history
├── docs/
│   ├── operations.md            # local run, prod topology, observability, LGPD
│   ├── demo-script.md           # timed hackathon demo + criteria mapping
│   └── what-changed.md          # what was built, why, and what the AI generated
└── README.md
```

---

## Quick start

Prerequisites: **Node.js 22+**, npm, and Docker with Compose. The demo database is
isolated on port **5433** so it does not collide with a local PostgreSQL.

```bash
# 1. Configure the backend (never commit .env)
cp Backend/.env.example Backend/.env
#    replace JWT_SECRET, OTP_PEPPER and AI_INTERNAL_TOKEN with random values

# 2. Start the tmp dependencies: Postgres 5433, MailHog and Adminer
#    (`docker compose -f Backend/docker-compose.yml up -d` also builds and
#     starts the containerized API — see "Full stack in containers" below.)
docker compose -f Backend/docker-compose.yml up -d db mailhog adminer

# 3. Install, apply the schema and seed the fictional demo data
cd Backend
npm install
npm run db:migrate
npm run db:seed
npm run start:dev
```

The API is then available at the endpoints below. `npm run start:dev` binds port **3001**,
so do not run it at the same time as the containerized `api` service.

| URL | Purpose |
| --- | --- |
| `http://localhost:3001/api/health` | Liveness probe (public) |
| `http://localhost:3001/api/ready` | Readiness probe: Postgres + AI (public) |
| `http://localhost:3001/docs` | Swagger UI |
| `http://localhost:8025` | MailHog inbox (validation codes) |
| `http://localhost:8081` | Adminer (`db` / `postgres` / `postgres`) |

Ports: API **3001**, tmp PostgreSQL **5433** (5432 inside the container), MailHog SMTP
**1025** and UI **8025**, Adminer **8081**.

### Full stack in containers

To run the API in Docker as well (production-style multi-stage image, non-root):

```bash
docker compose -f Backend/docker-compose.yml up -d --build
```

Migrations and seeds still run from the host because the runtime image intentionally ships
production dependencies only (no Prisma CLI). The compose `api` service expects the
Python copilot at `http://ai:8000`; without an `ai` service on the compose network,
readiness reports `checks.ai: "down"` and `status: "degraded"` while the consultation
still works.

### Shared contracts

`Backend` consumes `@telemed/service-contracts` via `file:../service-contracts`. Compiled
types are committed under `service-contracts/dist`, so a fresh clone installs without a
build step. If you change a payload:

```bash
cd service-contracts && npm install && npm run build && npm run typecheck
```

Then update the producer, the consumer and `service-contracts/CHANGELOG.md` in the same
change (see [`service-contracts/README.md`](service-contracts/README.md)).

---

## Seeded demo accounts

All accounts are **fictional** and share the password `Demo@1234`.

| E-mail | Role | Name | Specialty | CRM |
| --- | --- | --- | --- | --- |
| `medico@digitaly.health` | doctor | Dra. Helena Marques | Cardiologia | CRM-SP 123456 |
| `medico2@digitaly.health` | doctor | Dr. Rafael Nogueira | Dermatologia | CRM-RJ 654321 |
| `paciente@digitaly.health` | patient | Joao Pereira | — | — |
| `paciente2@digitaly.health` | patient | Maria Souza | — | — |

The seed also creates a `pending_code` appointment (24h ahead), a `confirmed` appointment
(2h ahead), a completed consultation with a medical record and pre-consult answers from
last week, and a confirmed appointment whose validation code was already consumed.

**Validation codes are delivered to MailHog**, not to a real inbox. Request the code in the
app, open `http://localhost:8025`, and read the 6-digit code from the message with subject
`Seu código de validação — Digitaly Telemedicine`. The code is stored only as an
HMAC-SHA256 hash and expires after 10 minutes (5 attempts).

Doctor self-registration is **disabled by default**. `POST /api/auth/register` with
`role: "doctor"` returns `403 FORBIDDEN` unless `ALLOW_DOCTOR_SELF_REGISTRATION=true`
(e2e tests set it to `true`; keep it `false` in production and seed doctors instead).

---

## Environment variables

Documented in [`Backend/.env.example`](Backend/.env.example); placeholder values only.
Required variables have no default and the API refuses to boot without them.

| Variable | Required | Example (placeholder) | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `PORT` | no | `3001` | API listen port |
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@localhost:5433/digitaly_tmp` | PostgreSQL connection |
| `WEB_ORIGIN` | no | `http://localhost:3000` | CORS allow-list (comma-separated) |
| `JWT_SECRET` | yes | `<random>` | Access-token signing key |
| `JWT_EXPIRES_IN` | no | `15m` | Access-token TTL |
| `JWT_REFRESH_EXPIRES_IN` | no | `7d` | Refresh-token TTL |
| `ALLOW_DOCTOR_SELF_REGISTRATION` | no | `false` | Permit `role=doctor` registration |
| `SWAGGER_ENABLED` | no | `true` | Mount `/docs` (set `false` in production) |
| `MAIL_HOST` / `MAIL_PORT` | no | `localhost` / `1025` | SMTP for validation codes |
| `MAIL_USER` / `MAIL_PASSWORD` | no | empty | SMTP credentials (omitted for MailHog) |
| `MAIL_FROM` | no | `no-reply@digitaly.health` | Sender address |
| `OTP_PEPPER` | yes | `<random>` | Peppers hashed validation codes |
| `OTP_TTL_SECONDS` | no | `600` | Validation-code expiry |
| `OTP_MAX_ATTEMPTS` | no | `5` | Brute-force limit |
| `AI_SERVICE_URL` | no | `http://localhost:8000` | Python copilot HTTP base URL |
| `AI_BASE_URL` / `AI_WS_URL` | no | empty | Optional HTTP/WS overrides |
| `AI_INTERNAL_TOKEN` | yes | `<random>` | Service-to-service auth (`X-Internal-Token`) |
| `UPLOAD_DIR` | no | `./uploads` | Attachment storage root |
| `UPLOAD_MAX_BYTES` | no | `10485760` | Per-file size limit (10 MiB) |
| `STORAGE_DRIVER` | no | `local` | `local` today; object storage in production |
| `STUN_URLS` | no | `stun:stun.l.google.com:19302` | WebRTC ICE STUN servers |
| `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` | prod | empty | TURN relay for restrictive NAT |

Secrets come from the environment or a secret manager — never from the image or git. See
[`docs/operations.md`](docs/operations.md) for the production topology and rotation notes.

---

## API overview

Full specification: [`service-contracts/http/openapi.yaml`](service-contracts/http/openapi.yaml)
(OpenAPI 3.1, global prefix `/api`) and the live Swagger UI at `/docs`.

**Auth** — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`,
`POST /api/auth/logout`, `GET /api/auth/me`.

**Users** — `GET|PATCH /api/users/me`, `GET /api/users/doctors` (`?specialty`, `?q`),
`GET /api/users/patients/{patientId}` (doctor linked through a non-cancelled appointment).

**Appointments** — `GET /api/appointments/doctors/{doctorId}/slots`,
`POST /api/appointments` (with optional pre-consult), `GET /api/appointments/calendar`,
`GET /api/appointments/doctor`, `GET /api/appointments/{id}`,
`POST /api/appointments/{id}/request-code`, `POST /api/appointments/{id}/resend-code`,
`POST /api/appointments/{id}/verify-code`, `POST /api/appointments/{id}/cancel`,
`GET|PUT /api/appointments/{id}/pre-consult`.

**Consultations** — `POST /api/appointments/{id}/consultations/start` (returns room id and
ICE servers), `GET /api/consultations/mine`, `GET /api/consultations/{id}`,
`POST /api/consultations/{id}/end`.

**Records** — `GET /api/patients/{patientId}/overview`, `GET /api/records/history`,
`POST /api/records`, `GET /api/records/{recordId}`.

**Attachments** — `GET|POST /api/appointments/{id}/attachments`,
`GET /api/attachments/{id}` (streams stored bytes, `nosniff`). Allowed types: PDF, PNG,
JPEG, WebP, plain text; max 10 MiB.

**Health** — `GET /api/health` (liveness), `GET /api/ready` (Postgres + AI readiness).

**Realtime** — Socket.IO namespace `/realtime`, JWT in `handshake.auth.token`. Client
events: `room.join`, `room.leave`, `webrtc.offer`, `webrtc.answer`, `webrtc.ice`,
`media.state`, `audio.chunk`, `audio.end`. Server events include `room.joined`,
`room.error`, `participant.joined|left`, `consultation.started|ended`, `transcript.*`,
`copilot.feedback` and `ai.status`.

Errors are always the shared `ErrorResponseDto` shape with a `correlationId` and a stable
`ErrorCode` (for example `SLOT_TAKEN`, `INVALID_OR_EXPIRED_CODE`, `CONSULTATION_NOT_ACTIVE`).

---

## Testing

```bash
cd Backend
npm run lint        # ESLint (with --fix)
npm run typecheck   # tsc --noEmit (runs prisma generate first)
npm test            # 22 unit suites / 151 tests, no database required
npm run test:e2e    # 13 e2e suites / 78 tests, serial (--runInBand), needs PostgreSQL
```

`npm run test:e2e` sets `ALLOW_DOCTOR_SELF_REGISTRATION=true` and runs suites serially to
avoid races on the shared demo database. Start the tmp Postgres and apply migrations first.
Contracts have their own checks: `cd service-contracts && npm run typecheck`.

Latest verified run on this checkout: **22/151 unit** and **13/78 e2e**, NestJS 11,
Prisma 7.10 with the `@prisma/adapter-pg` driver adapter.

---

## LGPD, privacy and security notes

Health data is sensitive personal data under LGPD (Art. 11). This project applies the
following, matching the `lgpd-healthcare` guidance:

- **Fictional data only.** No real patient data exists in the repository, seeds, tests or
  demo. Demo accounts and clinical content in `prisma/seed.ts` are invented.
- **Data minimization.** Validation codes are stored only as HMAC-SHA256 hashes;
  refresh tokens are opaque random values stored as SHA-256 hashes; raw audio is not
  persisted by the API (`AI` receives streamed frames and is expected not to retain raw
  audio unless explicitly justified and consented).
- **No PII in logs.** The request logger records method, path, status, latency and actor id
  only. Tokens, validation codes, e-mails, SDP and transcripts are never logged. Audit
  metadata is filtered to drop sensitive keys and e-mail-like values.
- **Auditability.** Sensitive access and auth events write append-only `audit_logs` rows
  with actor, action, resource, outcome and correlation id: logins/refresh reuse,
  appointment create/confirm/cancel and code request/verify, consultation start/end,
  medical-record create/read, patient overview read, consultation history read, and
  attachment upload/download.
- **Least privilege.** Global authentication plus role guards and per-resource checks
  (patients own their appointments/records; doctors only see patients linked through a
  non-cancelled appointment).
- **Transport and storage.** TLS/WSS in transit in production; attachments are PHI and
  should live in a private object store with encryption at rest and short-lived signed
  URLs. Locally they are stored on disk under `UPLOAD_DIR` and never served statically.

Retention caveats: the API writes and reads audit rows but does not yet run an automated
retention/partition job. Define retention windows per data class (for example transcript
30–90 days, medical records per the applicable legal period) and enforce deletion with
scheduled jobs. See [`docs/operations.md`](docs/operations.md) §6.

---

## Known limitations / next steps

- **This repository is the API + contracts.** The Next.js web app and the Python FastAPI
  copilot are separate services. The API defines and enforces their contracts but their UI
  and STT/LLM providers are out of scope here.
- **Single-node realtime.** Socket.IO presence is in-process memory; multi-instance
  deployments need the Redis adapter (or sticky sessions) for fan-out and deploys.
- **Local storage.** `STORAGE_DRIVER=local` writes attachments to disk. Production should
  add an S3-compatible driver with private buckets and signed URLs.
- **Realtime revocation latency.** Access tokens are validated per socket handshake and
  live for their TTL (15m by default); a refreshed/revoked token is not force-disconnected.
- **Reminder notifications.** No e-mail/SMS reminder job before an appointment yet.
- **Retention automation.** Audit and record retention jobs are not implemented.
- **Doctor self-registration** is disabled; production onboarding for doctors is manual
  (seeded/admin-created users) until an admin flow exists.
- **AI provider.** The FastAPI service and its STT/LLM provider are external; if it is
  down, consultations continue and the copilot panel shows `ai.status: "unavailable"`.
