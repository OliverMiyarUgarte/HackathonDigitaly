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
(both must use the real `https://${DOMAIN}` origin), and `AI_PROVIDER`.

Validate the rendered Compose model. This is read-only: it parses, interpolates and
prints the configuration without creating containers, networks or volumes.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
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

Seed the demo data once. The `seed` service is behind a profile and is a one-shot:
it never runs on every boot. It needs `OTP_PEPPER` because the seed writes a demo
validation code.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile seed run --rm seed
```

Verify TLS, routing and health from the VPS:

```bash
curl -sI https://digitaly.tech | head -20          # HSTS + security headers
curl -s  https://digitaly.tech/api/health           # liveness -> 200 {"status":"ok"}
curl -s  https://digitaly.tech/api/ready             # readiness -> 200 (degraded still 200)
curl -s  https://digitaly.tech/health               # ai is internal: use the API check
curl -sI https://digitaly.tech/docs | head -1        # 404 (blocked)
```

Demo smoke test in a browser:

1. Open `https://digitaly.tech`, log in as `paciente@digitaly.health` / `Demo@1234`.
2. Book/confirm an appointment (validation code is sent through the configured SMTP).
3. Log in as `medico@digitaly.health` / `Demo@1234` and open the consultation room.
4. Confirm audio/video connects (WebRTC) and the copilot transcript panel updates.

## 3. Updates

Back up first (see [Backups](#5-backup-and-restore)). Then:

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml config   # sanity check
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
service). A backup that only lives on the VPS is not a backup.

Restore the database from a dump:

```bash
# Stop writers first so no data changes during restore
docker compose --env-file .env.production -f docker-compose.prod.yml stop api web

# --clean --if-exists drops and recreates objects from the dump
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl \
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
  validation codes out of logs. MailHog is for local development only.
- **Secrets manager.** Inject secrets from Vault/AWS Secrets Manager at deploy time
  instead of a host file; restrict file permissions (`chmod 600 .env.production`) and
  rotate `JWT_SECRET`, `OTP_PEPPER`, `AI_INTERNAL_TOKEN`, DB and SMTP credentials
  independently.
- **Host hardening.** Key-only SSH, no root login, `fail2ban`, automatic security
  updates, UFW as above, and a non-root deploy user. Consider `docker` root-equivalence
  when granting group membership.
- **Observability.** Keep JSON logs with the `x-correlation-id` propagated web -> api ->
  ai. Add Prometheus metrics (request rate/latency/errors, socket connections, STT
  pipeline lag), OpenTelemetry traces and Sentry for exceptions. Alert on readiness
  failures, error-budget burn, socket drops, STT lag and disk/volume pressure.
- **TURN for WebRTC.** STUN alone fails on restrictive clinic networks. Deploy coturn
  (or a managed TURN) on a public IP with short-lived credentials and set
  `TURN_URLS`/`TURN_USERNAME`/`TURN_CREDENTIAL`; open the TURN ports in the firewall.
- **LGPD.** PHI stays encrypted in transit and at rest, access is audited, retention is
  enforced, and STT/LLM/SMTP providers are operators under a data processing agreement.
  See `docs/operations.md`.

## 8. Demo vs production

| Concern | Demo (this stack) | Production target |
| --- | --- | --- |
| Database | Postgres container, local volume | Managed Postgres, backups + PITR |
| Attachments | `digitaly_uploads` volume | Object storage, signed URLs |
| API replicas | One | Two or more + Redis Socket.IO adapter |
| TLS | Caddy automatic HTTPS | Same, plus CDN/WAF in front |
| Secrets | `.env.production` on the VPS | Secrets manager, injected at deploy |
| Email | Real SMTP or MailHog locally | SES/Postmark with SPF/DKIM/DMARC |
| AI | `AI_PROVIDER=fake` or OpenAI | Pinned provider + DPA, STT fallback |
| Backups | `backup` service + cron | Automated, off-site, restore-tested |
| Monitoring | JSON logs, health/ready probes | Metrics, traces, Sentry, alerts |
| TURN | STUN only | coturn / managed TURN |

Keep the demo credentials (`Demo@1234`, seeded doctors) out of any real environment:
override or delete the seed data before onboarding real users.
