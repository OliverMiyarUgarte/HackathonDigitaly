# Digitaly Telemedicine

A full-stack teleconsultation platform for Brazil. The patient books a specialist, confirms
the slot with a 6-digit code sent by e-mail, and meets the doctor in a video room where an
AI copilot streams transcription and real-time clinical feedback to the clinician.

**The problem:** access to specialists is slow and fragmented - booking is one tool,
confirmation is another, the consultation is a third, and the medical record lives in a
fourth. Digitaly puts the whole path in one platform with a single shared contract between
the services.

This repository contains the **integrated platform**: the Next.js web app, the NestJS API,
the FastAPI AI copilot, the PostgreSQL schema, and the single-VPS production stack. See
[`docs/demo-script.md`](docs/demo-script.md) for the timed presentation and
[`docs/what-changed.md`](docs/what-changed.md) for the build history and the honest
AI-generated-vs-reviewed story.

---

## End-to-end demo path

1. **Patient** logs in at `/entrar`, opens `/paciente/agendar`, picks a doctor and a weekday
   30-minute slot, and answers the pre-consult questions.
2. The booking is created as `pending_code`; the patient requests a **6-digit e-mail code**,
   reads it in MailHog, and confirms on `/paciente/confirmar-agendamento`. The appointment
   moves to `confirmed`.
3. The appointment appears on `/paciente/calendario`.
4. **Doctor** logs in, opens `/medico/atendimentos`, sees the agenda with the pre-consult
   flag, reviews the patient at `/medico/pacientes/[patientId]`, and starts the
   teleconsultation.
5. The **patient receives a real-time notification** (Socket.IO `/realtime` namespace) and
   joins the video room at `/paciente/consultas/[consultationId]`; WebRTC
   offer/answer/ICE is relayed through the API.
6. The doctor's browser converts microphone audio to **PCM s16le, 16 kHz, mono** and streams
   it over the socket; the API proxies it to the Python copilot and relays
   `transcript.partial`, `transcript.final` and `copilot.feedback` back **to the doctor
   only**.
7. The doctor ends the consultation, the appointment becomes `completed`, and the medical
   record is written at `/medico/consultas/[consultationId]/fechamento`.

---

## Architecture

```text
                  +--------------------------------------------------+
                  |                 Browser (patient / doctor)       |
                  |   Next.js 16 App Router        WebRTC media      |
                  |   /entrar /paciente /medico    (DTLS-SRTP)       |
                  +----------------------+---------------------------+
                                         |  HTTPS + WSS
                      +------------------v-------------------+
                      |  Caddy (production edge)             |
                      |  TLS, security headers, routing      |
                      |  /api + /socket.io -> api, else web  |
                      +------------------+-------------------+
                                         |
             +---------------------------+---------------------------+
             |                           |                           |
   +---------v---------+      +----------v---------+      +----------v--------+
   |  Next.js web      |      |  NestJS API        |      |  FastAPI copilot  |
   |  :3000            |      |  :3001             |      |  :8000            |
   |  patient/doctor   |      |  auth, scheduling, |      |  STT + clinical   |
   |  UI, video room,  |      |  records, sockets, |      |  feedback over WS |
   |  copilot panel    |      |  mail, AI proxy    |      |  (optional)       |
   +-------------------+      +--+------+------+---+      +-------------------+
                                 |      |      |
                      Prisma/pg  |      | SMTP |  HTTP + WS
                      (driver-pg)|      |      |  (X-Internal-Token)
                                 v      v      v
                          +-----------+ +---------+
                          |PostgreSQL | | MailHog |
                          | users,    | | (local) |
                          |appointments|+---------+
                          |records,   |
                          |audit      |
                          +-----------+
                                 ^
                                 |  local disk today, object store in prod
                          +------+------+
                          | Attachments |
                          +-------------+

   @telemed/service-contracts: REST DTOs, OpenAPI 3.1, Socket.IO event maps
   and Nest <-> Python AI frames, imported by all three services.
```

Key properties:

- **Three services + database.** `front-end/` (Next.js), `Backend/` (NestJS), `BackendPython/`
  (FastAPI) and PostgreSQL 16. Contracts live once in `service-contracts/` and are imported
  by every producer and consumer.
- **Modular monolith API.** One NestJS process with clear domain modules - `auth`, `users`,
  `appointments`, `consultations`, `records`, `attachments`, `realtime`, `ai`, `mail`,
  `health` - plus cross-cutting `common` (guards, filters, interceptors, audit). Global
  `JwtAuthGuard` and `RolesGuard` apply app-wide: every route requires authentication unless
  marked `@Public()`, and `@Roles(...)` restricts routes by role.
- **Contracts first.** Every HTTP body, WebSocket event and Nest<->Python frame is defined
  once in `@telemed/service-contracts` (TypeScript types, OpenAPI 3.1, Pydantic v2 mirror).
  The package has its own semver and [`CHANGELOG.md`](service-contracts/CHANGELOG.md).
- **PostgreSQL** stores users, hashed refresh tokens, appointments, hashed validation codes,
  consultations, medical records, pre-consult answers, attachment metadata and an
  append-only audit log, via Prisma 7 with the `@prisma/adapter-pg` driver adapter.
- **Real-time** runs on a JWT-authenticated Socket.IO namespace `/realtime`, with
  per-appointment rooms and per-user rooms for notifications.
- **AI is optional by design.** If the copilot is unreachable, readiness reports `degraded`
  and the doctor sees `ai.status: "unavailable"`; the consultation still works.
- **Production edge.** `docker-compose.prod.yml` runs `web`, `api`, `ai`, `db` and a Caddy
  `proxy` on one VPS; only Caddy publishes host ports.

---

## Repository layout

```text
HackathonDigitaly/
├── Backend/                     # NestJS 11 API
│   ├── prisma/                  # schema (9 models), migrations, fictional seed
│   ├── src/                     # domain modules, guards, filters, audit, AI proxy
│   ├── test/                    # 13 e2e suites (serial, needs PostgreSQL)
│   ├── docker-compose.yml       # tmp Postgres, MailHog, Adminer, optional API container
│   ├── Dockerfile               # multi-stage, non-root, migrations on entrypoint
│   └── README.md                # backend-specific guide
├── front-end/                   # Next.js 16 App Router + TypeScript + Tailwind 4
│   ├── app/                     # (auth), paciente, medico routes
│   ├── components/              # design-system UI, patient/doctor/consultation modules
│   ├── lib/                     # API client, zod contracts, auth, realtime hooks
│   ├── e2e/                     # Playwright suite (25 tests)
│   └── Dockerfile               # standalone Next build, non-root
├── BackendPython/               # FastAPI AI copilot
│   ├── app/                     # pipeline, sessions, providers (fake/local/openai)
│   ├── tests/                   # 39 pytest tests (fake providers, no network)
│   ├── scripts/dev_ws_client.py # stream a WAV through the AI contract
│   ├── Dockerfile               # python:3.12-slim, non-root, /health healthcheck
│   └── README.md                # AI-specific guide
├── service-contracts/           # @telemed/service-contracts
│   ├── types/                   # REST DTOs and enums
│   ├── events/                  # Socket.IO maps and Nest<->Python frames
│   ├── http/openapi.yaml        # OpenAPI 3.1 (global prefix /api)
│   ├── python/contracts.py      # handwritten Pydantic v2 mirror
│   └── CHANGELOG.md             # contract semver history
├── deploy/                      # Caddyfile, API entrypoint, backups dir
├── docs/                        # operations, data model, deploy, demo, design system
├── docker-compose.prod.yml      # single-VPS stack (web, api, ai, db, proxy)
├── .env.production.example      # production variable template
└── README.md
```

---

## Quick start

Prerequisites: **Node.js 22+**, npm, **Python 3.11+** (for the AI service) and Docker with
Compose. The local database is isolated on port **5433** so it does not collide with a local
PostgreSQL.

### 1. Backend API + local dependencies

```bash
# Configure the API (never commit .env)
cp Backend/.env.example Backend/.env
#    replace JWT_SECRET, OTP_PEPPER and AI_INTERNAL_TOKEN with random values

# Start the local dependencies: Postgres 5433, MailHog, Adminer.
# The compose file also defines an `api` container; start it only if you do NOT
# run `npm run start:dev` (both bind port 3001).
docker compose -f Backend/docker-compose.yml up -d db mailhog adminer

cd Backend
npm install
npm run db:migrate     # prisma migrate dev (applies the schema)
npm run db:seed        # fictional demo users and appointments
npm run start:dev      # API on http://localhost:3001
```

The API is then available at the endpoints below. `/docs` (Swagger UI) is mounted **only
when `SWAGGER_ENABLED=true`**; `Backend/.env.example` sets it to `true` for local
development, while the code default and the production compose keep it `false`.

### 2. Web app

```bash
cd front-end
cp .env.example .env
#    NEXT_PUBLIC_API_URL=http://localhost:3001/api
#    NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
#    NEXT_PUBLIC_MAILHOG_URL=http://localhost:8025   (optional: renders the demo inbox link)
npm install
npm run dev            # web on http://localhost:3000
```

### 3. AI copilot

```bash
cd BackendPython
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # set AI_INTERNAL_TOKEN to match Backend/.env
AI_PROVIDER=fake uvicorn app.main:app --app-dir . --host 0.0.0.0 --port 8000 --env-file .env
```

Equivalently, from the repository root (the service reads `os.environ`, so either pass
`--env-file` or export the variables):

```bash
AI_PROVIDER=fake AI_INTERNAL_TOKEN=<same-as-backend> \
  uvicorn app.main:app --app-dir BackendPython --port 8000
# or: uvicorn app.main:app --app-dir BackendPython --port 8000 --env-file BackendPython/.env
```

`AI_PROVIDER=fake` runs fully offline (`FakeTranscriber` + `RuleCopilot`). Or build the
image: `docker build -t digitaly-ai BackendPython && docker run --rm -p 8000:8000 --env-file BackendPython/.env digitaly-ai`.

### Local URLs

| URL | Purpose |
| --- | --- |
| `http://localhost:3000` | Web app (patient / doctor) |
| `http://localhost:3001/api/health` | API liveness probe (public) |
| `http://localhost:3001/api/ready` | API readiness probe: Postgres + AI (public) |
| `http://localhost:3001/docs` | Swagger UI (only with `SWAGGER_ENABLED=true`) |
| `http://localhost:8000/health` | AI copilot health |
| `http://localhost:8025` | MailHog inbox (validation codes) |
| `http://localhost:8081` | Adminer (`db` / `postgres` / `postgres`) |

Ports: web **3000**, API **3001**, AI **8000**, tmp PostgreSQL **5433**
(5432 inside the container), MailHog SMTP **1025** / UI **8025**, Adminer **8081**.

### Full stack in containers (optional)

To run the NestJS API in Docker as well (multi-stage, non-root image with migrations on the
entrypoint):

```bash
docker compose -f Backend/docker-compose.yml up -d --build
```

The API container runs `prisma migrate deploy` on startup through
`deploy/entrypoint-api.sh`, after waiting for Postgres. **Seeds** still run from the host
(or through the production `seed` profile) because the runtime image omits dev-only tooling
such as `tsx`, which `prisma db seed` uses. The compose `api` service expects the Python
copilot at `http://ai:8000`; without an `ai` service on the compose network, readiness
reports `checks.ai: "down"` and `status: "degraded"` while the consultation still works. Do
not run this together with `npm run start:dev` - both bind port 3001.

### Shared contracts

`Backend` and `front-end` consume `@telemed/service-contracts` via
`file:../service-contracts`. Compiled types are committed under `service-contracts/dist`, so
a fresh clone installs without a build step. If you change a payload:

```bash
cd service-contracts && npm install && npm run build && npm run typecheck
```

Then update the producer, the consumers and `service-contracts/CHANGELOG.md` in the same
change (see [`service-contracts/README.md`](service-contracts/README.md)).

---

## Production (single VPS)

The full runbook is [`docs/deploy-vps.md`](docs/deploy-vps.md). Summary:

```bash
cp .env.production.example .env.production   # fill in secrets, DOMAIN, ACME_EMAIL, MAIL_*
docker compose --env-file .env.production -f docker-compose.prod.yml config -q
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

- **One command** builds and starts `web`, `api`, `ai`, `db` and `proxy` (Caddy). Only Caddy
  publishes ports 80/443; the database and AI service stay on the internal network.
- **Migrations** run automatically: the API entrypoint waits for Postgres and runs
  `prisma migrate deploy` before the app boots. Seeds run once through the `seed` profile:
  `docker compose ... --profile seed run --rm seed`.
- **`SEED_DEMO_PASSWORD` is required by the seed profile** and replaces the local
  `Demo@1234` fallback. Generate it with `openssl rand -base64 24`.
- **Do not seed demo data on a public host without access control.** The seed creates
  well-known accounts; anyone who can reach the site and knows an account address can log
  in. Enable the optional Caddy `basic_auth` or `remote_ip` allowlist in
  [`deploy/Caddyfile`](deploy/Caddyfile) and set a strong `SEED_DEMO_PASSWORD` first. On a
  private host, skip seeding or delete the demo rows before onboarding real users.
- **Backups**: the one-shot `backup` profile writes a `pg_dump` into `deploy/backups/`;
  schedule it with cron and copy dumps off-site (encrypted). See the runbook.

---

## Demo accounts and e-mail codes

All accounts are **fictional** and share the local-development password `Demo@1234`
(`SEED_DEMO_PASSWORD` overrides it when seeding in production).

| E-mail | Role | Name | Specialty | CRM |
| --- | --- | --- | --- | --- |
| `medico@digitaly.health` | doctor | Dra. Helena Marques | Cardiologia | CRM-SP 123456 |
| `medico2@digitaly.health` | doctor | Dr. Rafael Nogueira | Dermatologia | CRM-RJ 654321 |
| `paciente@digitaly.health` | patient | Joao Pereira | - | - |
| `paciente2@digitaly.health` | patient | Maria Souza | - | - |

The seed also creates a `pending_code` appointment (24h ahead), two `confirmed` appointments
with consumed validation codes (2h and 3h ahead), and a completed consultation from last
week with a medical record and all 5 pre-consult answers.

**Validation codes are delivered to MailHog in development**, not to a real inbox. Request
the code in the app, open `http://localhost:8025`, and read the 6-digit code from the message
with subject `Seu código de validação — Digitaly Telemedicine`. The code is stored only as an
HMAC-SHA256 hash and expires after 10 minutes (5 attempts). Set
`NEXT_PUBLIC_MAILHOG_URL=http://localhost:8025` to show the MailHog link inside the
confirmation screen.

Doctor self-registration is **disabled by default**. `POST /api/auth/register` with
`role: "doctor"` returns `403 FORBIDDEN` unless `ALLOW_DOCTOR_SELF_REGISTRATION=true` (the e2e
suite sets it to `true`; keep it `false` in production and seed doctors instead).

---

## Testing

| Service | Command | Suites / tests | Requirements |
| --- | --- | --- | --- |
| API unit | `cd Backend && npm test` | **24 suites / 169 tests** | none (no database) |
| API e2e | `cd Backend && npm run test:e2e` | **13 suites / 78 tests** | PostgreSQL + migrations; runs serially (`--runInBand`) |
| Web | `cd front-end && npm run test:e2e` | **25 Playwright tests** (5 files) | seeded DB, API 3001, web 3000 |
| AI | `cd BackendPython && pytest` | **39 tests** (7 files) | fake providers only, no network |
| Contracts | `cd service-contracts && npm run typecheck` | type-level | none |

Also: `npm run lint` and `npm run typecheck` in `Backend` and `front-end`.
`front-end` Playwright uses one worker because the suite mutates the shared seed and the media
room; `global-setup.ts` logs in the four seeded accounts. AI tests never download a model or
touch the network; `ruff check .` and `ruff format --check .` cover lint.

---

## Scripts per service

**Backend (`Backend/`)**

| Script | Purpose |
| --- | --- |
| `npm run start:dev` | Nest watch mode (port 3001) |
| `npm run build` / `npm run start:prod` | Production build / run |
| `npm run lint` / `npm run typecheck` | ESLint `--fix` / `tsc --noEmit` |
| `npm test` / `npm run test:e2e` | Unit / serial e2e |
| `npm run db:migrate` | Create/apply a migration (development) |
| `npm run db:deploy` | Apply committed migrations (CI/staging/production) |
| `npm run db:seed` | Idempotent fictional seed |
| `npm run db:reset` | Drop, re-apply and re-seed |
| `npm run db:studio` | Prisma Studio |

**Web (`front-end/`)**

| Script | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run start` | Next.js dev / build / production |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run test:e2e` | Playwright |
| `npm run screenshots` | Regenerate `docs/screenshots/` |

**AI (`BackendPython/`)**

| Command | Purpose |
| --- | --- |
| `uvicorn app.main:app --app-dir . --port 8000` | Run the service |
| `pytest` | Test suite (fake providers) |
| `ruff check .` / `ruff format --check .` | Lint / format check |
| `python scripts/dev_ws_client.py audio.wav --token $AI_INTERNAL_TOKEN` | Stream a WAV through the contract |

**Contracts (`service-contracts/`)**

| Script | Purpose |
| --- | --- |
| `npm run build` | Emit `dist/` (`.js` + `.d.ts`) |
| `npm run typecheck` | `tsc --noEmit` |

---

## Key environment variables

Full lists: [`Backend/.env.example`](Backend/.env.example),
[`front-end/.env.example`](front-end/.env.example),
[`BackendPython/.env.example`](BackendPython/.env.example) and
[`.env.production.example`](.env.production.example). The API refuses to boot without
`DATABASE_URL`, `JWT_SECRET`, `OTP_PEPPER` and `AI_INTERNAL_TOKEN`; the AI service boots with
an empty `AI_INTERNAL_TOKEN` but then rejects every session, so keep the token in sync on
both sides (the readiness probe only calls the public `/health`).

**API**

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection |
| `JWT_SECRET` | yes | Access-token signing key |
| `OTP_PEPPER` | yes | Peppers hashed e-mail validation codes |
| `AI_INTERNAL_TOKEN` | yes | Shared with the AI service (`X-Internal-Token`) |
| `PORT` | no | `3001` |
| `WEB_ORIGIN` | no | Comma-separated CORS allow-list |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | no | `15m` / `7d` |
| `ALLOW_DOCTOR_SELF_REGISTRATION` | no | `false` |
| `SWAGGER_ENABLED` | no | `false` in code; `.env.example` sets `true` locally |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_FROM` / `MAIL_USER` / `MAIL_PASSWORD` | no | SMTP for validation codes |
| `OTP_TTL_SECONDS` / `OTP_MAX_ATTEMPTS` | no | `600` / `5` |
| `AI_SERVICE_URL` | no | `http://localhost:8000` (`http://ai:8000` in prod) |
| `UPLOAD_DIR` / `UPLOAD_MAX_BYTES` / `STORAGE_DRIVER` | no | `./uploads` / `10485760` / `local` |
| `STUN_URLS` / `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` | prod for TURN | WebRTC ICE |

**Web**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL (e.g. `http://localhost:3001/api`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO origin (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_MAILHOG_URL` | Optional; when set, shows the MailHog link on the confirmation screen |

**AI**

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `fake` | `fake`, `local` (Whisper) or `openai` |
| `AI_INTERNAL_TOKEN` | empty | Shared secret with the API; empty rejects everything |
| `OPENAI_API_KEY` / `LLM_MODEL` / `OPENAI_BASE_URL` | - | `LlmCopilot` when `AI_PROVIDER=openai` |
| `WHISPER_MODEL` / `WHISPER_DEVICE` / `WHISPER_COMPUTE_TYPE` | `base` / `cpu` / `int8` | Local STT |
| `SESSION_TTL_SECONDS` / `MAX_BUFFER_BYTES` / `PARTIAL_INTERVAL_SECONDS` | `900` / `1920000` / `2.5` | Session and streaming limits |

Secrets come from the environment or a secret manager - never from the image or git. See
[`docs/operations.md`](docs/operations.md) for rotation and the production topology.

---

## API and realtime overview

Full specification: [`service-contracts/http/openapi.yaml`](service-contracts/http/openapi.yaml)
(OpenAPI 3.1, global prefix `/api`) and the live Swagger UI at `/docs` when enabled.

**Auth** - `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`,
`POST /api/auth/logout`, `GET /api/auth/me`.

**Users** - `GET|PATCH /api/users/me`, `GET /api/users/doctors` (`?specialty`, `?q`),
`GET /api/users/patients/{patientId}` (doctor linked through a non-cancelled appointment).

**Appointments** - `GET /api/appointments/doctors/{doctorId}/slots`,
`POST /api/appointments` (with optional pre-consult), `GET /api/appointments/calendar`,
`GET /api/appointments/doctor`, `GET /api/appointments/{id}`,
`POST /api/appointments/{id}/request-code`, `POST /api/appointments/{id}/resend-code`,
`POST /api/appointments/{id}/verify-code`, `POST /api/appointments/{id}/cancel`,
`GET|PUT /api/appointments/{id}/pre-consult`.

**Consultations** - `POST /api/appointments/{id}/consultations/start` (returns room id and
ICE servers), `GET /api/consultations/mine`, `GET /api/consultations/{id}`,
`POST /api/consultations/{id}/end`.

**Records** - `GET /api/patients/{patientId}/overview`, `GET /api/records/history`,
`POST /api/records`, `GET /api/records/{recordId}`.

**Attachments** - `GET|POST /api/appointments/{id}/attachments`, `GET /api/attachments/{id}`
(streams stored bytes with `nosniff`). Allowed types: PDF, PNG, JPEG, WebP, plain text; max
10 MiB.

**Health** - `GET /api/health` (liveness), `GET /api/ready` (Postgres + AI readiness).

**Realtime** - Socket.IO namespace `/realtime`, JWT in `handshake.auth.token`. Client events:
`room.join`, `room.leave`, `webrtc.offer`, `webrtc.answer`, `webrtc.ice`, `media.state`,
`audio.chunk`, `audio.end`. Server events include `room.joined`, `room.error`,
`participant.joined|left`, `consultation.started|ended`, `transcript.*`, `copilot.feedback`
and `ai.status`.

Errors are always the shared `ErrorResponseDto` shape with a `correlationId` and a stable
`ErrorCode` (for example `SLOT_TAKEN`, `INVALID_OR_EXPIRED_CODE`, `CONSULTATION_NOT_ACTIVE`).

---

## LGPD, privacy and security notes

Health data is sensitive personal data under LGPD (Art. 11). This project applies the
following, matching the `lgpd-healthcare` guidance:

- **Fictional data only.** No real patient data exists in the repository, seeds, tests or
  demo. Demo accounts and clinical content in `Backend/prisma/seed.ts` are invented.
- **Data minimization.** Validation codes are stored only as HMAC-SHA256 hashes; refresh
  tokens are opaque random values stored as SHA-256 hashes; the API streams audio to the AI
  service and does not persist raw audio.
- **No PII in logs.** The request logger records method, path, status, latency and actor id
  only. Tokens, validation codes, e-mails, SDP, transcripts and audio are never logged. Audit
  metadata is filtered to drop sensitive keys and e-mail-like values. The AI service logs
  error codes, not content, and keeps buffers in memory only.
- **Auditability.** Sensitive access and auth events write append-only `audit_logs` rows with
  actor, action, resource, outcome and correlation id: logins/refresh reuse, appointment
  create/confirm/cancel and code request/verify, consultation start/end, medical-record
  create/read, patient overview read, consultation history read, and attachment
  upload/download.
- **Least privilege.** Global authentication plus role guards and per-resource checks
  (patients own their appointments and records; doctors only see patients linked through a
  non-cancelled appointment).
- **Transport and storage.** TLS/WSS in transit is provided by Caddy in the production stack.
  Attachments are PHI and should live in a private object store with encryption at rest and
  short-lived signed URLs; locally they live on disk under `UPLOAD_DIR` and are never served
  statically.

**Operator TODOs (not implemented in this stack):** automated audit/transcript retention and
deletion jobs; encryption at rest for the database and object storage; and a managed
STT/LLM/SMTP provider under a data processing agreement. Define retention windows per data
class (for example transcript 30-90 days, medical records per the applicable legal period)
and enforce them with scheduled jobs. See [`docs/operations.md`](docs/operations.md) §6 and
[`docs/deploy-vps.md`](docs/deploy-vps.md) §7.

---

## Known limitations / next steps

- **Single-node realtime.** Socket.IO presence is in-process memory; multi-instance
  deployments need the Redis adapter (or sticky sessions) for fan-out during deploys.
- **Local storage.** `STORAGE_DRIVER=local` writes attachments to disk. Production should add
  an S3-compatible driver with private buckets and signed URLs.
- **Realtime revocation latency.** Access tokens are validated per socket handshake and live
  for their TTL (15m by default); a refreshed/revoked token is not force-disconnected.
- **Reminder notifications.** No e-mail/SMS reminder job before an appointment yet.
- **Retention automation.** Audit and record retention jobs are not implemented; these are
  operator responsibilities (see LGPD above).
- **Doctor onboarding.** Self-registration is disabled; production doctors are seeded or
  manually created until an admin flow exists.
- **AI provider.** `AI_PROVIDER=fake` is the offline demo default. `local`/`openai` require
  the optional Whisper extra or an OpenAI key and, for `openai`, a documented legal basis and
  DPA.
- **Single-VPS production.** The compose stack is production-shaped but a single point of
  failure (local Postgres volume, one API replica, local attachments). See the scaling
  section of [`docs/deploy-vps.md`](docs/deploy-vps.md).

---

## Documentation index

| Document | Contents |
| --- | --- |
| [`docs/demo-script.md`](docs/demo-script.md) | Timed demo, pt-BR narration, criteria mapping, fallbacks |
| [`docs/what-changed.md`](docs/what-changed.md) | What was built, why, integration history, AI-vs-human |
| [`docs/operations.md`](docs/operations.md) | Local run, production topology, observability, LGPD |
| [`docs/deploy-vps.md`](docs/deploy-vps.md) | Single-VPS deploy, backups, rollback, scaling |
| [`docs/data-model.md`](docs/data-model.md) | Entities, indexes, seed state, LGPD per column |
| [`docs/design-system.md`](docs/design-system.md) | Digitaly design system (pt-BR) |
| [`docs/screenshots/`](docs/screenshots/) | Desktop and mobile screenshots of the integrated UI |
| [`service-contracts/README.md`](service-contracts/README.md) | Contract package and versioning rules |
| [`Backend/README.md`](Backend/README.md) | API-specific guide |
| [`BackendPython/README.md`](BackendPython/README.md) | AI copilot guide |
