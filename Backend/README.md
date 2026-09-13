# Digitaly Telemedicine API

NestJS 11 service for the Digitaly telemedicine MVP. Owns authentication, scheduling,
e-mail validation codes, consultations, medical records, attachments, WebSocket events,
the audit trail and the proxy to the Python AI copilot.

See the [root README](../README.md) for the product and architecture, and
[`docs/operations.md`](../docs/operations.md) for operations, the production topology and
LGPD. HTTP/WebSocket payloads live in [`../service-contracts`](../service-contracts).

## Prerequisites

- Node.js 22+ and npm
- Docker with Compose (for the tmp Postgres, MailHog and Adminer)
- The `@telemed/service-contracts` package resolves via `file:../service-contracts`;
  compiled types are committed under `service-contracts/dist`, so no monorepo build is
  required for a fresh clone.

## Environment

```bash
cd Backend
cp .env.example .env
# replace JWT_SECRET, OTP_PEPPER and AI_INTERNAL_TOKEN with random values
```

Never commit `.env`. The full variable list is in [`.env.example`](.env.example) and the
root README. The API validates its environment with Joi at boot and refuses to start if a
required secret is missing.

## Database: migrate, seed, reset

The tmp database runs on port **5433** from the host (`5432` in the container).

```bash
docker compose -f docker-compose.yml up -d db mailhog adminer

npm install
npm run db:migrate   # prisma migrate dev (development)
npm run db:seed      # loads the fictional demo users and appointments
```

| Script | Purpose |
| --- | --- |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply committed migrations (CI/staging/production) |
| `npm run db:seed` | Run `prisma/seed.ts` (idempotent, fixed UUIDs) |
| `npm run db:reset` | Drop, re-apply migrations and re-seed the demo state |
| `npm run db:studio` | Prisma Studio |

The seed creates fictional accounts only; the shared local-development password is
`Demo@1234` (`medico@`, `medico2@`, `paciente@`, `paciente2@digitaly.health`). Production
seeding requires `SEED_DEMO_PASSWORD` and must not expose these accounts publicly (see
[`../docs/deploy-vps.md`](../docs/deploy-vps.md)). Validation codes are delivered to MailHog
at `http://localhost:8025`.

## Run

```bash
npm run start:dev     # watch mode, generates the Prisma client first
npm run start         # nest start
npm run build         # nest build (prebuild runs prisma generate)
npm run start:prod    # node dist/main
```

Once running: Swagger at `http://localhost:3001/docs` (only when `SWAGGER_ENABLED=true`;
`Backend/.env.example` sets it for local development, the code default is `false`), liveness
at `http://localhost:3001/api/health`, readiness at `http://localhost:3001/api/ready`.
Do not run `start:dev` while the containerized `api` service is up — both bind port 3001.

## Test and quality

```bash
npm run lint        # ESLint with --fix
npm run typecheck   # tsc --noEmit (runs prisma generate first)
npm test            # 24 unit suites / 169 tests, no database required
npm run test:e2e    # 13 e2e suites / 78 tests, serial, needs PostgreSQL
```

`test:e2e` sets `ALLOW_DOCTOR_SELF_REGISTRATION=true` and uses `--runInBand` because the
suites share the demo database. Start Postgres and apply migrations before running it.

## Docker

The compose stack runs Postgres, MailHog, Adminer and the API. The API container waits for
Postgres and runs `prisma migrate deploy` on startup (`deploy/entrypoint-api.sh`). Seeds run
from the host or through the production `seed` profile, because the runtime image omits
`tsx`, which `prisma db seed` uses.

```bash
docker compose -f docker-compose.yml up -d --build
```

The image is multi-stage and runs as the non-root `nestjs` user with a healthcheck on
`/api/health`. Compose expects the AI copilot at `http://ai:8000`; without it, readiness
reports `checks.ai: "down"` and `status: "degraded"` while the API keeps serving.

## Module map

| Module | Responsibility |
| --- | --- |
| `auth` | Register/login/refresh/logout, argon2id, JWT + rotating refresh tokens |
| `users` | Profile, doctor directory, scoped patient lookup |
| `appointments` | Slots, booking, OTP confirmation, calendars, agenda, pre-consult |
| `consultations` | Start/end, WebRTC session setup, patient history |
| `records` | Patient overview, pre-consult upsert, medical records |
| `attachments` | Upload/list/download, local storage driver |
| `realtime` | Socket.IO gateway, appointment/user rooms, presence, WebRTC signaling |
| `ai` | HTTP/WS proxy to the Python copilot, doctor-only feedback relay |
| `mail` | Nodemailer validation-code e-mails |
| `health` | Liveness and readiness |
| `common` | Guards, exception filter, interceptors, request context, audit |
| `prisma` | PrismaService with the `@prisma/adapter-pg` driver adapter |

## Contracts

DTO classes implement the types from `@telemed/service-contracts` and validate at the
boundary with `class-validator`. When a payload changes, update the package
(`types/`, `events/`, `http/openapi.yaml`, `python/contracts.py`) and the
[`CHANGELOG.md`](../service-contracts/CHANGELOG.md) in the same change, then run
`npm run typecheck` in both packages.
