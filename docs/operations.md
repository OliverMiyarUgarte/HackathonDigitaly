# Digitaly Telemedicine - Operations

Operational guide for the NestJS API (`Backend/`), its local Docker Compose stack, the
conceptual production topology, and the observability and LGPD controls around it.

## 1. Local run

Prerequisites: Node.js 22+, npm, Docker with Compose.

```bash
cd Backend
cp .env.example .env          # fill in JWT/OTP/internal secrets (never commit .env)

# 1. Start the tmp dependencies and wait for Postgres to be healthy
docker compose up -d db mailhog adminer

# 2. Apply schema + demo seed from the host (DATABASE_URL points at localhost:5433)
npm install
npm run db:deploy
npm run db:seed

# 3. Build and start the API container (db + mailhog + adminer + api)
docker compose up --build
```

Endpoints once up:

| URL | Purpose |
| --- | --- |
| `http://localhost:3001/api/health` | Liveness probe (public) |
| `http://localhost:3001/api/ready` | Readiness probe (public) |
| `http://localhost:3001/docs` | Swagger UI |
| `http://localhost:8025` | MailHog inbox |
| `http://localhost:8081` | Adminer (`db` / `postgres` / `postgres`) |

The Compose file uses `env_file: .env` for secrets and only overrides non-secret values
(`DATABASE_URL`, mail and AI hosts, `UPLOAD_DIR`). Container names stay `digitaly-tmp-*`
and uploads live in the named volume `digitaly_tmp_uploads`.

Migrations and seeds run from the host because the runtime image intentionally ships
production dependencies only (no Prisma CLI). The build stage keeps the CLI; the runtime
stage copies only the generated client and `dist`.

## 2. Environment variables

Documented in `Backend/.env.example`. Compose overrides the last column.

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `production` | `development` / `test` / `production` |
| `PORT` | no | `3001` | API listen port |
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@db:5432/digitaly_tmp` | Managed Postgres in prod |
| `WEB_ORIGIN` | no | `http://localhost:3000` | Comma-separated CORS allow-list |
| `JWT_SECRET` | yes | `<random>` | Access token signing key |
| `JWT_EXPIRES_IN` | no | `15m` | Access token TTL |
| `JWT_REFRESH_SECRET` | yes | `<random>` | Refresh token signing key |
| `JWT_REFRESH_EXPIRES_IN` | no | `7d` | Refresh token TTL |
| `MAIL_HOST` / `MAIL_PORT` | no | `mailhog` / `1025` | SMTP for validation codes |
| `MAIL_USER` / `MAIL_PASSWORD` | no | empty | SMTP credentials |
| `MAIL_FROM` | no | `no-reply@digitaly.health` | Sender address |
| `OTP_PEPPER` | yes | `<random>` | Peppers hashed validation codes |
| `OTP_TTL_SECONDS` | no | `600` | Code expiry |
| `OTP_MAX_ATTEMPTS` | no | `5` | Brute-force limit |
| `AI_SERVICE_URL` | no | `http://ai:8000` | FastAPI HTTP base URL |
| `AI_BASE_URL` / `AI_WS_URL` | no | empty | Optional overrides |
| `AI_INTERNAL_TOKEN` | yes | `<random>` | Service-to-service auth |
| `UPLOAD_DIR` | no | `/app/uploads` | Attachment storage root |
| `UPLOAD_MAX_BYTES` | no | `10485760` | Per-file size limit |
| `STORAGE_DRIVER` | no | `local` | `local` today; S3-compatible in prod |
| `STUN_URLS` | no | `stun:stun.l.google.com:19302` | WebRTC ICE |
| `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` | prod | empty | TURN relays for restrictive networks |

Secrets must come from the environment or a secret manager, never from the image or git.

## 3. Production topology

```text
                          +-------------------------------+
                          |   Browser (patient / doctor)   |
                          |  HTTPS  +  WebRTC media (DTLS) |
                          +---------------+---------------+
                                          |
                                   TLS 1.2+/WSS
                                          |
                        +-----------------v------------------+
                        |   WAF / CDN  ->  Load balancer      |
                        |   (TLS termination, health checks)  |
                        +--+---------------+---------------+---+
                           |               |               |
                  /web     |       /api    |        /ai    |
                           v               v               v
                   +-------+----+  +-------+----+  +-------+-----+
                   | Next.js web |  | NestJS api |  | FastAPI ai  |
                   | stateless   |  | stateless  |  | stateless   |
                   +-------+----+  +--+---+---+--+  +-------+-----+
                           |          |   |   |             |
                           |          |   |   +--- STT/LLM --+
                           |          |   |        (operator DPA)
                           |          |   |
              +------------+          |   +----------------------+
              |                       |                          |
              v                       v                          v
     +-----------------+     +-----------------+        +----------------+
     | Managed Postgres|     | Object storage  |        | Redis pub/sub  |
     | backups + PITR  |     | PHI attachments |        | Socket.IO bus  |
     +-----------------+     +-----------------+        +----------------+
                                                             |
                                                     +-------v--------+
                                                     |  TURN server   |
                                                     | (media relay)  |
                                                     +----------------+
```

Key points:

- Web, API and AI are stateless and scale horizontally behind the load balancer.
  Session affinity (sticky sessions) or the Redis Socket.IO adapter provides
  multi-instance WebSocket fan-out; the Redis adapter is preferred because it removes
  the need for stickiness during deploys.
- PostgreSQL is managed (backups, PITR, private networking, TLS). The API only ever
  reaches it over the private network.
- Consultation attachments are PHI: store them in an object store with SSE, private
  buckets, short-lived signed URLs and per-resource authorization checks. Never serve
  them from a public static path.
- TURN relays media for clinics/hospitals behind restrictive NAT/firewalls; STUN alone
  is not enough for the demo in those networks.
- Images are immutable and identical across staging/production; only configuration and
  secrets differ, injected at deploy time.

## 4. Observability

**Structured logs + correlation id.** Every request gets an `x-correlation-id`
(`CorrelationIdInterceptor`); the same id is returned to the client and should be
propagated to the AI service and included in every log line and audit entry. Log JSON in
production so it can be shipped to the log platform. `LoggingInterceptor` records method,
path, status, latency and actor id. Never log PII, tokens, validation codes or
transcripts.

**Liveness vs readiness.**

| Endpoint | Question | Behavior |
| --- | --- | --- |
| `GET /api/health` | Is the process alive? | Always `200` while the event loop responds |
| `GET /api/ready` | Can this instance serve traffic? | `200` when ready; `503` when the database is down |

`/api/ready` pings Postgres with `SELECT 1` and calls `GET {AI_SERVICE_URL}/health` with a
short timeout. A database failure returns `503` with `status: "degraded"` and
`checks.database: "down"`. The AI copilot being unreachable returns `200` with
`status: "degraded"` and `checks.ai: "down"`, because a consultation must still work
without transcription. Kubernetes/ECS probes should use `/api/health` for liveness and
`/api/ready` for readiness.

**Metrics to track.** Request rate, latency (p50/p95/p99), error rate per route; socket
connections and reconnect rate; WebRTC connection success and ICE failure rate; STT
pipeline lag (audio ingest to transcript) and copilot feedback latency; Postgres
connection pool saturation; attachment upload failures.

**Traces and errors.** Emit OpenTelemetry spans across web -> api -> ai, including the
correlation id as baggage, and export to the tracing backend. Send exceptions to Sentry
with the correlation id attached. Dashboards and alerts are built from the metrics above
(readiness failures, error budget burn, socket drops, STT lag spikes).

**Audit.** Access to patient records and attachments writes an `audit_logs` row
(actor, action, resource, timestamp) for LGPD accountability.

## 5. Secrets management

- Never commit `.env`; only `Backend/.env.example` documents variable names.
- Production reads secrets from a managed secret store (AWS Secrets Manager, GCP Secret
  Manager, Vault), injected as environment variables at deploy time and mounted only in
  memory.
- The container image contains no secrets; build args are limited to a dummy
  `DATABASE_URL` used exclusively for `prisma generate`.
- Rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, `OTP_PEPPER` and `AI_INTERNAL_TOKEN`
  regularly; rotate the database and SMTP credentials independently.
- Keep development, staging and production secrets separate; least-privilege access.

## 6. LGPD retention (recordings and transcripts)

Health data is sensitive personal data under LGPD (Art. 11). Apply the following:

- **Legal basis and transparency.** Process consultation data under the provision of
  health services / explicit consent, and inform the patient about what is captured and
  for how long.
- **Minimization.** Do not persist raw audio unless it is explicitly justified and
  consented. Prefer storing only the derived transcript and the medical record. Hash
  validation codes instead of storing them.
- **Retention windows.** Define per-data-class windows, for example: consultation audio
  (if hosted) 30 days; transcripts 30-90 days; medical records per the applicable
  professional/legal retention period; refresh tokens and validation codes expire
  automatically. Enforce deletion with scheduled jobs and verify the delete path.
- **Third parties.** STT/LLM and email providers are operators: sign a data processing
  agreement, send the minimum data, and prefer providers that do not train on the data.
- **Security.** TLS/WSS in transit, encryption at rest for the database and object
  storage, least-privilege access, and short-lived signed URLs for attachments.
- **Data subject rights.** Support access, correction and deletion requests; use
  soft-delete plus a retention policy rather than keeping permanent copies. Record every
  access in the audit log.

No real patient data may appear in the repository, seeds, tests or the demo; use
fictional data only.
