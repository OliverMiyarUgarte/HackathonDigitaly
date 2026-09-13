# Deploying Digitaly to a single VPS

This guide deploys the whole platform (`web`, `api`, `ai`, `db`, `proxy`) to one VPS
with Docker Compose. `Caddy` is the only public entrypoint and terminates TLS for the
public domain. The database and AI service are never published to the host.

> Demo vs production: this single-VPS stack is production-shaped but still a single
> point of failure. It uses a local Postgres volume, local attachment storage and
> in-memory Socket.IO fan-out. See [Scaling and hardening](#scaling-and-hardening) for
> the managed-services and multi-replica target.

## Topology

```text
                 Internet (443/80)
                        |
                 +------v------+
                 |    proxy    |  Caddy: TLS, headers, routing
                 | caddy:2     |
                 +--+-------+--+
        /api, /socket.io |    | everything else
                 +------v+  +v-------+
                 |  api  |  |  web   |
                 | :3001 |  | :3000  |
                 +---+---+  +--------+
                     |  \            \
                     |   \            \ (egress only)
                     |    +--> ai:8000  SMTP / OpenAI / ACME
                     |
              +------v------+
              |     db      |  postgres:16, volume digitaly_pgdata
              |   :5432     |
              +-------------+

networks: digitaly_internal (internal-only) + digitaly_egress (outbound for api/ai/web/proxy)
volumes:  digitaly_pgdata, digitaly_uploads, digitaly_ai_models,
          digitaly_caddy_data, digitaly_caddy_config
```

Only `proxy` publishes host ports (`80`, `443`, `443/udp`). `db` is attached to the
internal network only and has no route out.

## 1. Prerequisites

- A VPS with Ubuntu 22.04/24.04, at least 2 vCPU / 4 GB RAM / 40 GB disk.
  Whisper locally needs more RAM; the default `AI_PROVIDER=fake` does not.
- Docker Engine + Compose plugin.
- A public domain whose DNS you control.
- SSH key access and a non-root user with `sudo`.

Install Docker (once):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in so the `docker` group applies, then check:

```bash
docker version
docker compose version
```

### DNS

Create these records at your DNS provider **before** the first boot, or Caddy cannot
complete the ACME challenge:

| Type | Name | Value |
| --- | --- | --- |
| A | `digitaly.tech` (apex) | VPS IPv4 |
| A | `www.digitaly.tech` | VPS IPv4 |
| AAAA | `digitaly.tech` / `www` | VPS IPv6 (only if IPv6 is fully routed) |

If you do not want the `www` redirect, delete the `www.{$DOMAIN}` block in
`deploy/Caddyfile`. If `DOMAIN` itself starts with `www.`, delete that block as well.

### Firewall

Only SSH, HTTP and HTTPS need to be reachable. Postgres, the API and the AI service
stay internal.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

## 2. First deploy

Clone the repository and create the production environment file.

```bash
git clone <repo-url> digitaly && cd digitaly
cp .env.production.example .env.production
```

Generate every secret. Never reuse the placeholders and never commit `.env.production`.

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # OTP_PEPPER
openssl rand -hex 32   # AI_INTERNAL_TOKEN
openssl rand -hex 32   # POSTGRES_PASSWORD (hex avoids URL-encoding issues)
```

Edit `.env.production` and set at least: `DOMAIN`, `ACME_EMAIL`, `POSTGRES_*`,
`DATABASE_URL` (keep it consistent with `POSTGRES_*`), `JWT_SECRET`, `OTP_PEPPER`,
`AI_INTERNAL_TOKEN`, `MAIL_*`, `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL`
(both must use the real `https://${DOMAIN}` origin), `SEED_DEMO_PASSWORD` (if you plan
to seed), and `AI_PROVIDER`. Keep `AI_PROVIDER=fake` for the demo: `openai` sends
consultation audio/transcripts to a third party and requires a documented legal basis
plus a signed DPA (LGPD).

`DEMO_BASIC_AUTH_USER` / `DEMO_BASIC_AUTH_HASH` are required: the shipped Caddyfile
protects the web UI and the MailHog inbox with HTTP basic auth. The bcrypt hash
contains `$`, which Compose interpolates, so escape every `$` as `$$` in
`.env.production` (e.g. `$$2a$$14$$...`). Basic auth is deliberately not applied
to `/api` or `/socket.io`, so the app's Bearer JWT still reaches the API. Generate
the hash with:

```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'YOUR_PASSWORD'
```

`MAIL_*` defaults to the bundled MailHog service (`MAIL_HOST=mailhog`,
`MAIL_PORT=1025`); the demo inbox is at `mail.$DOMAIN` behind the same basic auth.
Switch `MAIL_*` to a real provider (Brevo/Resend/SendGrid) for production delivery.
With no domain yet, use an `sslip.io` name such as `203-0-113-10.sslip.io` (your IP
with dashes) for `DOMAIN`; Caddy still obtains a Let's Encrypt certificate.

Validate the rendered Compose model. This is read-only: it parses, interpolates and
checks the configuration without creating containers, networks or volumes. Always
pass `-q`: plain `config` prints every interpolated value, **including secrets**, to
your terminal and shell history.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config -q
```

Build and start the stack. `up -d --build` builds the images, creates the internal
networks and named volumes, then starts containers in dependency order. The API
entrypoint waits for Postgres and runs `prisma migrate deploy` before the app boots.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Watch the first boot:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api proxy
```

`api` logs should show the migrations being applied and `Nest application successfully
started`. `proxy` logs should show certificates obtained for `DOMAIN` and `www.DOMAIN`.

> **The seeded demo is protected by HTTP basic auth, not exposed.** The seed
> creates fictional but well-known accounts (`medico@digitaly.health`,
> `paciente@digitaly.health`, …) whose password comes from `SEED_DEMO_PASSWORD`.
> The shipped Caddyfile requires `DEMO_BASIC_AUTH_USER` / `DEMO_BASIC_AUTH_HASH`
> and applies it to the web UI and MailHog; `/api` keeps JWT auth so the app
> works. Set a strong `SEED_DEMO_PASSWORD` anyway. On a private host either skip
> seeding or delete the demo rows before onboarding real users.

Seed the demo data once. The `seed` service is behind the `seed` profile and is a
one-shot: it never runs on every boot. It waits for the `api` service to become
healthy, so `prisma migrate deploy` has already created the schema (important on a
fresh stack). It needs `OTP_PEPPER` (the seed writes a demo validation code) and
`SEED_DEMO_PASSWORD`.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile seed run --rm seed
```

`run` starts the dependencies (`db`, `api`) if they are not already running, waits
for `api` to report healthy, runs the seed once and exits. The local development
fallback password `Demo@1234` is only for an isolated dev machine.

Verify TLS, routing and health from the VPS:

```bash
curl -sI https://$DOMAIN | head -20                  # HSTS + security headers; 401 without basic auth
curl -s  -u $DEMO_BASIC_AUTH_USER:PASSWORD https://$DOMAIN/api/health   # API is not behind basic auth
curl -s  https://$DOMAIN/api/ready                    # readiness -> 200 (degraded still 200)
curl -sI https://$DOMAIN/docs | head -1               # 404 (blocked)
curl -sI https://mail.$DOMAIN | head -1               # 401 without basic auth
```

Demo smoke test in a browser:

1. Open `https://$DOMAIN`; the browser prompts for `DEMO_BASIC_AUTH_*`.
2. Log in as `paciente@digitaly.health` with `SEED_DEMO_PASSWORD`.
3. Book/confirm an appointment; the validation code appears in the MailHog inbox
   at `https://mail.$DOMAIN` (same basic auth).
4. Log in as `medico@digitaly.health` and open the room; confirm WebRTC connects
   and the copilot transcript panel updates.

## 3. Updates

Back up first (see [Backups](#5-backup-and-restore)). Then:

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml config -q  # sanity check (plain `config` leaks secrets)
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

What happens: Compose recreates only changed services, `api` re-runs
`prisma migrate deploy` on start (idempotent), and `proxy` keeps serving. On a single
VPS there is a short restart window for `web`/`api`. For near-zero downtime, run two API
replicas behind Caddy with sticky sessions plus the Socket.IO Redis adapter
(see [Scaling and hardening](#scaling-and-hardening)); otherwise accept seconds of
downtime and deploy outside consultation hours.

If only application code changed and not `db`:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps --build api web
```

## 4. Logs and status

```bash
# Container state and health
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Follow logs (Caddy access logs are JSON)
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=200 api
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100 proxy

# Resource usage and disk
docker stats --no-stream
df -h /var/lib/docker
docker system df
```

Useful probes:

| Endpoint | Meaning | Use |
| --- | --- | --- |
| `GET /api/health` | Process is alive | Liveness; always `200` while the event loop responds |
| `GET /api/ready` | DB reachable (AI optional) | Readiness; `503` only when Postgres is down |
| `GET /health` (AI, internal) | AI process + provider | Called by the API readiness check |
| `GET /health` (Caddy) | Edge is up | Load balancer / uptime checks |

Rotate Docker logs automatically: every service already uses the `json-file` driver
with `max-size: 10m` and `max-file: 3` (see the `x-logging` anchor in
`docker-compose.prod.yml`). Ship them off-box for real retention.

## 5. Backup and restore

### Database

Run the one-shot `backup` service. It writes a custom-format `pg_dump` into
`deploy/backups/` on the host (git-ignored).

```bash
mkdir -p deploy/backups
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile backup run --rm backup
ls -lh deploy/backups
```

Schedule it with cron (daily at 03:15) and copy dumps off-site:

```bash
# /etc/cron.d/digitaly-backup
15 3 * * * root cd /home/deploy/digitaly && docker compose --env-file .env.production -f docker-compose.prod.yml --profile backup run --rm backup >> /var/log/digitaly-backup.log 2>&1
```

Add an off-site copy (object storage, `rsync` to another host, or a managed backup
service). A backup that only lives on the VPS is not a backup. The dump contains
PHI: encrypt it before it leaves the host (for example `age` or `gpg`) and keep the
key separate from the ciphertext. Encrypt the attachment archive the same way.
Enable full-disk encryption on the VPS (LUKS) so the primary data and any local
dumps are protected at rest; this is an operator responsibility, not something this
stack configures for you.

Restore the database from a dump:

```bash
# Stop writers first so no data changes during restore
docker compose --env-file .env.production -f docker-compose.prod.yml stop api web

# Run pg_restore inside the container so POSTGRES_USER/POSTGRES_DB expand there
# (they are not set in your host shell). --clean --if-exists drops and recreates
# objects from the dump.
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' \
  < deploy/backups/digitaly-YYYYMMDD-HHMMSS.dump

docker compose --env-file .env.production -f docker-compose.prod.yml start api web
```

### Attachments

Attachments live in the `digitaly_uploads` volume. Archive and restore it with a
throwaway container:

```bash
# Backup
docker run --rm -v digitaly_uploads:/data -v "$PWD/deploy/backups":/backup alpine \
  sh -c 'tar czf /backup/uploads-$(date +%F).tgz -C /data .'

# Restore (into a stopped/empty volume)
docker run --rm -v digitaly_uploads:/data -v "$PWD/deploy/backups":/backup alpine \
  sh -c 'cd /data && tar xzf /backup/uploads-YYYY-MM-DD.tgz'
```

The `digitaly_ai_models` volume is only a model cache and can be rebuilt; back it up
only to avoid re-downloading Whisper weights.

Test a restore on a staging VPS at least once per quarter; an untested backup is a
guess.

## 6. Rollback

Migrations are forward-only, so rollback means restoring the database plus the previous
image/code. Keep the last known-good image tags before deploying:

```bash
docker image tag digitaly-api:prod digitaly-api:previous
docker image tag digitaly-web:prod digitaly-web:previous
docker image tag digitaly-ai:prod  digitaly-ai:previous
```

Application rollback (no schema change):

```bash
git checkout <last-good-commit>
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

If a migration was applied and must be undone, restore the pre-deploy dump from
[Backups](#5-backup-and-restore), then check out the matching code. If the migration
partially applied, inspect the `_prisma_migrations` table and use
`prisma migrate resolve` before redeploying. Never edit applied migration files.

## 7. Scaling and hardening

The single-VPS stack is the demo posture. Before real patients:

- **Multiple API replicas.** Socket.IO fan-out is in-memory, so two `api` containers
  each hold half the sockets. Add Redis and the Socket.IO Redis adapter, then either
  enable Caddy sticky sessions (`lb_policy cookie` or `ip_hash`) or rely on the adapter
  for cross-instance events. Add `redis` to the internal network and `--scale api=2`.
- **Managed PostgreSQL.** Move to RDS/Cloud SQL/Neon/Timescale with automated backups,
  PITR, TLS and private networking. Set `DATABASE_URL` with `sslmode=require` and remove
  the `db` service (and its volume) from the Compose file.
- **Object storage for attachments.** S3/R2/GCS with SSE, private buckets, short-lived
  signed URLs and per-resource authorization. `STORAGE_DRIVER=local` is the only
  implemented driver today; add the S3 driver before pointing at a bucket.
- **Real SMTP provider.** Use SES/Postmark/Resend with SPF, DKIM and DMARC, and keep
  validation codes out of logs. MailHog ships in the demo stack behind basic auth;
  do not run it for real patients.
- **Secrets manager.** Inject secrets from Vault/AWS Secrets Manager at deploy time
  instead of a host file; restrict file permissions (`chmod 600 .env.production`) and
  rotate `JWT_SECRET`, `OTP_PEPPER`, `AI_INTERNAL_TOKEN`, DB and SMTP credentials
  independently.
- **Reproducible images.** Pin base and runtime images by digest (for example
  `node:22-alpine@sha256:...`, `caddy:2-alpine@sha256:...`,
  `postgres:16-alpine@sha256:...`) so a deploy rebuilds the same bytes and a moved tag
  cannot silently ship new code. Renovate/Dependabot can propose digest bumps as
  reviewable PRs.
- **Python lockfile.** `BackendPython/requirements.txt` is not hash-locked. Generate a
  lockfile with hashes (`pip-compile --generate-hashes` or `uv lock`) and install with
  `--require-hashes` so the AI image is deterministic and supply-chain tampering is
  detectable.
- **Host hardening.** Key-only SSH, no root login, `fail2ban`, automatic security
  updates, UFW as above, and a non-root deploy user. Consider `docker` root-equivalence
  when granting group membership.
- **Disk and backup encryption.** Enable full-disk encryption (LUKS) on the VPS and
  encrypt database/attachment backups before any off-site copy, keeping the keys
  separate. Encryption at rest is an operator responsibility; this stack does not
  configure it.
- **Observability.** Keep JSON logs with the `x-correlation-id` propagated web -> api ->
  ai. Add Prometheus metrics (request rate/latency/errors, socket connections, STT
  pipeline lag), OpenTelemetry traces and Sentry for exceptions. Alert on readiness
  failures, error-budget burn, socket drops, STT lag and disk/volume pressure.
- **TURN for WebRTC.** STUN alone fails on restrictive clinic networks. Deploy coturn
  (or a managed TURN) on a public IP with short-lived credentials and set
  `TURN_URLS`/`TURN_USERNAME`/`TURN_CREDENTIAL`; open the TURN ports in the firewall.
- **LGPD (operator responsibility).** TLS/WSS in transit is provided by Caddy. Encryption
  at rest, audit-log retention and automated retention/deletion jobs are **not
  implemented in this stack**: they remain TODOs. Use a managed Postgres/object store
  with encryption at rest (or enable host/disk encryption) and add scheduled retention
  jobs before storing real patient data. Treat STT/LLM/SMTP providers as operators under
  a data processing agreement. See `docs/operations.md`.

## 8. Demo vs production

| Concern | Demo (this stack) | Production target |
| --- | --- | --- |
| Database | Postgres container, local volume | Managed Postgres, backups + PITR |
| Attachments | `digitaly_uploads` volume | Object storage, signed URLs |
| API replicas | One | Two or more + Redis Socket.IO adapter |
| TLS | Caddy automatic HTTPS | Same, plus CDN/WAF in front |
| Secrets | `.env.production` on the VPS | Secrets manager, injected at deploy |
| Email | MailHog in-stack behind basic auth | SES/Postmark with SPF/DKIM/DMARC |
| AI | `AI_PROVIDER=fake` or OpenAI | Pinned provider + DPA, STT fallback |
| Backups | `backup` service + cron | Automated, off-site, restore-tested |
| Monitoring | JSON logs, health/ready probes | Metrics, traces, Sentry, alerts |
| TURN | STUN only | coturn / managed TURN |

Keep the demo credentials out of any real environment: basic auth is already required
by the shipped Caddyfile, but also set a unique `SEED_DEMO_PASSWORD` (do not reuse
`Demo@1234` on a public host) or delete the seed data before onboarding real users.
