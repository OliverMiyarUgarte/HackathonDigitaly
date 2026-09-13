# Digitaly demo script

Timed, rehearsal-ready script for the hackathon presentation of the **integrated** platform:
Next.js web, NestJS API, FastAPI copilot and PostgreSQL, with a single shared contract. It
covers the happy path end to end and maps every moment to the official evaluation criteria.

Everything below is verified against the code in this repository. Screenshots used for slides
or as backup live in [`docs/screenshots/`](screenshots/):

| File | Screen |
| --- | --- |
| `01-login-*.png` | Login (`/entrar`) |
| `02-paciente-inicio-*.png` | Patient home (`/paciente`) |
| `03-paciente-agendar-*.png` | Booking wizard step 1 (`/paciente/agendar`) |
| `04-medico-atendimentos-*.png` | Doctor agenda (`/medico/atendimentos`) |
| `05-sala-teleconsulta-*.png` | Teleconsultation room pre-call lobby (doctor) |

Target duration: **7 minutes** (a 5-minute variant is at the end).

---

## Pre-flight checklist

Run through this 15 minutes before going on stage.

- [ ] `docker compose -f Backend/docker-compose.yml ps` shows Postgres healthy, MailHog and
      Adminer up.
- [ ] `cd Backend && npm run db:reset` to reload the fictional seed state (drops and
      re-applies migrations, then re-runs the idempotent seed).
- [ ] API up (`cd Backend && npm run start:dev`); `curl http://localhost:3001/api/health`
      returns `status: ok`.
- [ ] Web up (`cd front-end && npm run dev`, port 3000).
- [ ] AI up (`cd BackendPython && AI_PROVIDER=fake uvicorn app.main:app --app-dir . --port 8000 --env-file .env`,
      with `AI_INTERNAL_TOKEN` matching `Backend/.env`).
- [ ] `curl http://localhost:3001/api/ready` returns
      `{"status":"ok","checks":{"database":"up","ai":"up"}}` when the copilot is running, or
      `degraded` / `ai: down` if not (the demo still works).
- [ ] Swagger opens at `http://localhost:3001/docs` (requires `SWAGGER_ENABLED=true`, which
      `Backend/.env.example` sets for local development).
- [ ] MailHog opens at `http://localhost:8025` and shows an empty inbox (or an older code).
- [ ] Front-end `.env` has `NEXT_PUBLIC_API_URL=http://localhost:3001/api`,
      `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001` and
      `NEXT_PUBLIC_MAILHOG_URL=http://localhost:8025`.
- [ ] Two browsers (or normal + incognito) are open, one per persona, both logged out.
- [ ] Camera/microphone permission pre-granted in both browsers.
- [ ] A local file to attach (e.g. a small PDF or PNG) is on the desktop.
- [ ] Backup recording of the full flow is ready to play if the network fails.
- [ ] Demo accounts known: `paciente@digitaly.health` / `medico@digitaly.health`, password
      `Demo@1234` (local fallback; production uses `SEED_DEMO_PASSWORD`).

Presenter/roles: one **narrator**, one **driver** on the keyboard, and optionally one person
playing the patient on the second browser.

---

## Timed script

### 0:00 - 1:00 - Problem and goal (one slide)

**Say (pt-BR):** "No Brasil, conseguir uma consulta com especialista ainda é lento e
fragmentado: agendar é uma coisa, confirmar é outra, atender é outra, e o prontuário fica
em um quarto sistema. O Digitaly junta agendamento, confirmação segura por e-mail,
teleconsulta com vídeo e um copiloto de IA em uma única plataforma. Hoje vamos mostrar o
caminho completo, do agendamento ao prontuário, passando por dados em tempo real."

**Point at the architecture slide** (README or §Arquitetura below): "São três serviços —
web em Next.js, API em NestJS e copiloto em Python — mais o PostgreSQL, que conversam por um
contrato compartilhado. Em produção, o Caddy fica na borda."

### 1:00 - 2:30 - Patient books and confirms

| # | Route / screen | Action | Evidence (API behind it) |
| --- | --- | --- | --- |
| 1 | `/entrar` | Log in as `paciente@digitaly.health` | `POST /api/auth/login` -> JWT + rotating refresh token |
| 2 | `/paciente/agendar` | Filter by specialty (Cardiologia) or name; pick the doctor card | `GET /api/users/doctors?specialty=Cardiologia`, `?q=` |
| 3 | `/paciente/agendar` step 2 | Pick a weekday 30-minute slot (09:00-17:00) | `GET /api/appointments/doctors/{id}/slots` |
| 4 | `/paciente/agendar` step 3 | Answer the pre-consult fields (chief complaint, duration, medications, allergies, history) | sent with `POST /api/appointments` |
| 5 | `/paciente/agendar` step 4 | Review the summary and click **Confirmar agendamento** | `POST /api/appointments` -> `pending_code`; `SLOT_TAKEN` handled inline |
| 6 | `/paciente/confirmar-agendamento` | The screen requests the code automatically; click **Reenviar código** only to show it | `POST /api/appointments/{id}/request-code` (or `/resend-code`) -> 6-digit code e-mailed |
| 7 | MailHog `http://localhost:8025` | Open the e-mail and read the code; note the subject | subject `Seu código de validação — Digitaly Telemedicine` |
| 8 | Same screen | Type the 6 digits and click **Confirmar código** | `POST /api/appointments/{id}/verify-code` -> `confirmed` |
| 9 | `/paciente/calendario` | Show the confirmed appointment on the patient calendar | `GET /api/appointments/calendar` |

**Say (pt-BR):** "O agendamento nasce como `pending_code`. O código de seis dígitos não é
gravado: guardamos só o hash HMAC-SHA256, com prazo de dez minutos e limite de cinco
tentativas. A confirmação é transacional e só acontece uma vez. Reparem que o e-mail chegou
de verdade no MailHog — em produção é o provedor de e-mail configurado."

**Don't say** "we wrote everything by hand" - be accurate about AI-assisted generation (see
Entendimento do código).

### 2:30 - 4:30 - Doctor reviews and starts the teleconsultation

| # | Route / screen | Action | Evidence |
| --- | --- | --- | --- |
| 10 | `/entrar` (second browser) | Log in as `medico@digitaly.health` | Role guard restricts `/medico/*` to `doctor` |
| 11 | `/medico` | Show the doctor home card for the next appointment | `GET /api/appointments/doctor`, `GET /api/consultations/mine` |
| 12 | `/medico/atendimentos` | Filter by date/status; show the new booking with the **Pré-consulta: Respondida** badge | `GET /api/appointments/doctor?date=&status=` -> `DoctorAppointmentDto.hasPreConsult` |
| 13 | `/medico/pacientes/{patientId}?appointmentId={id}` | Show profile, selected appointment, pre-consult answers and history; call out the LGPD/privacy card | `GET /api/patients/{patientId}/overview`, `GET /api/appointments/{id}/pre-consult` |
| 14 | Back on the agenda, click **Iniciar teleatendimento** -> confirm the dialog | The room opens and the patient is notified | `POST /api/appointments/{id}/consultations/start` -> `active`, room id, ICE servers; `consultation.started` to the appointment room **and** the patient's user room |
| 15 | Patient browser | Show the real-time toast "Dra. Helena Marques iniciou o atendimento" and click **Entrar na sala** | Socket.IO `/realtime`; toast region is `aria-live` |

**Say (pt-BR):** "Antes de atender, a médica vê a queixa principal, a duração dos sintomas,
os medicamentos e as alergias que o paciente respondeu no agendamento — e o acesso é
restrito a profissionais com vínculo de atendimento. Ao iniciar, a API cria a consulta
dentro de uma transação e o paciente recebe uma notificação em tempo real, mesmo que ainda
não esteja na sala: o evento vai para a sala pessoal dele. O `start` é protegido por
transação e só cria uma consulta por agendamento; se ela já existir, a API responde
`CONSULTATION_EXISTS` e a tela abre a sala existente — não existe consulta duplicada."

### 4:30 - 6:00 - Video, PDF, AI copilot, end and record

| # | Route / screen | Action | Evidence |
| --- | --- | --- | --- |
| 16 | Room (`/medico/consultas/{id}` and `/paciente/consultas/{id}`) | In the pre-call lobby, click **Testar câmera e microfone**, then **Entrar na sala**; show mic/camera toggles | Socket.IO `/realtime`: `room.join`, `room.joined`, `participant.joined`, `webrtc.offer/answer/ice`, `media.state` |
| 17 | Doctor, sidebar | Open attachments and upload the file | `POST /api/appointments/{id}/attachments` (PDF/PNG/JPEG/WebP/TXT, <= 10 MiB); download streams bytes with `nosniff` |
| 18 | Doctor, copilot panel | Click **Ativar escuta** and speak; show `transcript.partial` / `transcript.final` and severity-grouped insights appearing **only on the doctor's screen** | browser PCM `pcm_s16le` 16 kHz mono -> `audio.chunk` -> API -> Python WS; `copilot.feedback` relayed to the doctor's user room only |
| 19 | Doctor, call controls | Click **Encerrar teleatendimento** and confirm | `POST /api/consultations/{id}/end` -> `ended`; `consultation.ended`; AI session closed |
| 20 | `/medico/consultas/{id}/fechamento` | Fill **Notas do atendimento** (required), diagnosis and prescriptions; click **Salvar prontuário** | `POST /api/records` (doctor-only, one record per consultation, `RECORD_EXISTS` guarded) |
| 21 | Patient browser | Show the post-call summary / history entry | `consultation.ended` and `GET /api/consultations/mine` |

**Say (pt-BR):** "A sinalização WebRTC passa pelo mesmo canal autenticado, então o navegador
nunca vê o token interno do copiloto. O áudio do microfone é convertido para PCM 16 kHz mono
no navegador, enviado para a API e repassado ao serviço Python; a transcrição e os alertas
clínicos voltam somente para a médica. Se o copiloto cair, a consulta continua: aparece o
estado `Copiloto indisponível`. No fim, a médica encerra e escreve o prontuário, que fica
auditado."

### 6:00 - 7:00 - Architecture, infra and LGPD closing (one or two slides)

**Say (pt-BR):** "A arquitetura são três serviços com um contrato único: os mesmos tipos
TypeScript, o OpenAPI e os eventos Socket.IO valem para a web, a API e o copiloto. A API é
um monólito modular com guardas globais e validação em toda fronteira. Na operação,
`/api/health` é liveness e `/api/ready` verifica Postgres e o copiloto: banco fora retorna
503; copiloto fora retorna degradado sem derrubar a consulta. Em produção, um único
`docker compose` sobe web, API, copiloto, banco e o Caddy na borda, com migrações
automáticas. Tudo é auditado e não gravamos PII, códigos nem transcrições em log. Os dados
de demonstração são fictícios, como manda a LGPD para dados de saúde."

Closing line: "Digitaly: agendamento, confirmação segura, teleconsulta e copiloto — em um
contrato só."

---

## Compressed 5-minute variant

Keep the same order, cut here:

- Drop the doctor's patient-overview detail (step 13) to one sentence.
- Skip the attachment upload or show it without narrating storage.
- Skip the record form (step 20) and just state "the record is saved and audited".
- Keep the OTP-in-MailHog moment and the real-time notification — they are the strongest
  beats.

---

## Evaluation criteria mapping

### Arquitetura

**Show:** the service diagram (README) plus `service-contracts/` and `Backend/src/`.

*Concrete evidence*

- Three services plus PostgreSQL with one contract package: `types/` (REST DTOs), `events/`
  (Socket.IO maps and Nest<->Python frames), `http/openapi.yaml` (OpenAPI 3.1) and
  `python/contracts.py` (Pydantic v2 mirror), versioned in `CHANGELOG.md`.
- The API is a modular monolith: `app.module.ts` wires domain modules, and global
  `JwtAuthGuard`, `RolesGuard`, `HttpExceptionFilter`, `CorrelationIdInterceptor` and
  `LoggingInterceptor` apply everywhere. DTO classes implement the shared contract types and
  are validated with `class-validator`; there is no `any` in the shared contracts. The web
  app validates with `zod`; the AI service validates with Pydantic.
- **Defensible tradeoff (say this):** audio goes *browser -> Nest -> Python* instead of the
  browser talking to Python directly. The browser only holds the user's JWT; the
  `X-Internal-Token` and the per-consultation ownership check stay server-side, and the
  copilot is optional. The cost is one extra hop and the API holding the socket session -
  worth it for a single authenticated, auditable boundary.

### Infra conceitual

**Show:** `docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/entrypoint-api.sh`,
`Backend/docker-compose.yml`, `docs/deploy-vps.md`.

*Concrete evidence*

- Local stack on isolated ports: Postgres 5433, MailHog 1025/8025, Adminer 8081, API 3001,
  web 3000, AI 8000; distinct `digitaly-tmp-*` container names and named volumes;
  dependencies bound to `127.0.0.1` so demo PHI is not network-exposed.
- Production stack: `proxy` (Caddy) is the only published entrypoint, `db` has no egress,
  `api` runs migrations on the entrypoint after waiting for Postgres, and images are
  multi-stage non-root with healthchecks.
- `GET /api/health` is liveness (always 200 while the process responds); `GET /api/ready`
  checks Postgres (`SELECT 1`) and the AI `/health`. Database down -> **503**; AI down ->
  **200 `degraded`** because a consultation must work without transcription.
- Caddy terminates TLS automatically, adds HSTS and a restrictive CSP, blocks `/docs` at the
  edge, and proxies `/api` and `/socket.io` to the API with long WebSocket timeouts.
- Backup/restore: the one-shot `backup` profile writes a `pg_dump` into `deploy/backups/`;
  the runbook covers cron, off-site encryption and restore. `digitaly_uploads` is archived
  separately.
- Observability: `x-correlation-id` on every request, structured logs (method, path, status,
  latency, actor id), append-only audit rows and the metrics list in
  `docs/operations.md` (§4).
- Scaling target (say, don't build): managed Postgres with PITR, private object storage for
  PHI, Redis Socket.IO adapter for multi-instance fan-out, TURN for restrictive networks,
  secrets from a secret manager.

### UI/UX

**Show:** the patient flow and the doctor flow side by side, then `docs/design-system.md`
and the Playwright polish suite.

*Concrete evidence*

- **Design system.** The front end is rebuilt on the Digitaly design system
  (`docs/design-system.md`, tokens in `front-end/app/globals.css`): Grafite structure with a
  single Celeste accent, Inter/IBM Plex Sans, liquid glass, pill controls, one primary
  action per screen. The polish suite asserts the brand gradient and rejects the default
  Tailwind palette (`front-end/e2e/polish.spec.ts`).
- **Two personas, clear hierarchy.** `/paciente` surfaces the next appointment as a feature
  card with a direct "Entrar na consulta" action; `/medico/atendimentos` is a filterable
  data table with the pre-consult flag and the start action; `/medico/pacientes/[id]`
  aggregates profile, selected appointment, pre-consult and history in one payload
  (`PatientOverviewDto`).
- **Nielsen heuristics in the UI:** visibility of system status (skeletons, status badges,
  the live "Conectado" indicator, the copilot status badge); user control and freedom
  (wizard back, cancel appointment, `Escape` closes dialogs, focus returns to the trigger);
  error prevention (zod validation, disabled actions, start/end confirmation dialogs,
  `SLOT_TAKEN` recovery); recognition over recall (pre-consult badge on the agenda);
  flexibility (specialty/name filters, "Hoje" / "Ver todas"); minimalist aesthetic (dark
  theme, single accent, 68-character text width); error recovery (stable `ErrorCode`s mapped
  to plain pt-BR messages, retry states); help (field hints, empty states, LGPD cards).
- **Accessibility.** `front-end/e2e/polish.spec.ts` verifies a single `h1` per route, no
  horizontal overflow at 375px and 1280px, no non-brand palette classes, an `aria-live`
  notification region, and a dialog that traps focus and restores it. The booking doctor
  picker is a `radiogroup`; slot buttons expose `aria-pressed`; the mic level is a
  `role="meter"`; code feedback is `aria-live`; the layout is keyboard navigable.

### Apresentação

- Rehearse the exact path twice with the driver; own the timing table above.
- Keep both browser sessions and all three services warm before you start talking.
- Use the fallbacks instead of debugging live. A calm fallback beats a frozen demo.
- Alternate speakers by module so it is clear the team understands the code (next section).

### Entendimento do código

Use [`docs/what-changed.md`](what-changed.md) as the running note. For each theme, one
teammate says: *what it does -> why it exists -> what the AI generated -> what I personally
reviewed or changed*. Suggestions:

| Theme | Owner should be able to explain |
| --- | --- |
| Contracts | How a payload change flows through types, OpenAPI, Pydantic and all three services |
| Data layer | Prisma models, indexes, why enums mirror the contracts, the fictional seed |
| Auth | argon2id, JWT access + opaque rotating refresh tokens, role guards, throttling |
| Booking + OTP | Advisory-lock race safety, HMAC code hashing, expiry and attempt cap |
| Realtime | JWT handshake, appointment vs user rooms, presence, signaling relay |
| Consultations | Transactional start/end, single-consultation guard, notifications, AI session lifecycle |
| Records | Role-scoped reads, one record per consultation, pre-consult upsert |
| Attachments | Storage abstraction, traversal safety, size/type allowlist, streaming |
| AI proxy + copilot | Buffered PCM frames, timeouts, doctor-only feedback, graceful degradation |
| Web UI | Design-system tokens, route structure, zod boundaries, audio worklet/PCM path |
| Ops / hardening / audit | Readiness semantics, correlation id, sanitized audit, container hardening |

**Be explicit about AI generation (say this):** "We used an AI coding agent to generate the
implementation commit by commit, including the first draft of the web UI and the Python
service. Each commit was reviewed and hardened by follow-up commits — the refresh-token
reuse fix, the booking/OTP race fix, the user alignment, the front-end rebuild on the design
system, the Python rewrite to match the shared contract, the DB index cleanup and the deploy
hardening. The human decisions were the contracts, module boundaries, security constraints,
LGPD posture and the demo narrative; the AI wrote the bulk of the code.
`docs/what-changed.md` records this per theme and points to the commits."

---

## pt-BR narration lines

Use these as written; they are product-facing and can be read aloud.

- "Vou entrar como paciente."
- "Escolho a Dra. Helena, especialidade Cardiologia."
- "Seleciono um horário de trinta minutos em um dia de semana e respondo as perguntas do
  pré-atendimento: queixa principal, duração dos sintomas, medicamentos, alergias e
  histórico."
- "Ao confirmar, o agendamento fica pendente até a validação por e-mail."
- "Aqui está o e-mail com o código de seis dígitos; vou digitá-lo para confirmar."
- "Agora a consulta aparece no meu calendário."
- "Agora entro como médica."
- "A médica vê o resumo do paciente e o pré-atendimento antes de iniciar."
- "Iniciando o teleatendimento. O paciente recebe a notificação em tempo real e entra na
  sala."
- "Podemos ligar e desligar microfone e câmera, e anexar um arquivo à consulta."
- "O copiloto transcreve a conversa e mostra alertas só para a médica."
- "A consulta terminou. Vou registrar as anotações, o diagnóstico e as prescrições."
- "Tudo isso com dados fictícios, sem gravar código nem transcrição em log."

Verified e-mail copy from `Backend/src/mail/mail.service.ts` (safe to show):

> **Assunto:** Seu código de validação — Digitaly Telemedicine
>
> Olá,
>
> Seu código de validação é: **123456**
>
> Ele expira em 10 minutos.
>
> Se você não solicitou este código, ignore este e-mail.
>
> Digitaly Telemedicine

---

## Fallbacks

### AI copilot down

- The consultation must continue. `/api/ready` returns `200` with
  `{"status":"degraded","checks":{"database":"up","ai":"down"}}`, the copilot panel shows
  **Copiloto indisponível**, and the video call is unaffected.
- Start it offline: from `BackendPython`,
  `AI_PROVIDER=fake uvicorn app.main:app --app-dir . --port 8000 --env-file .env` (no
  network, no model download). Say: "O copiloto está indisponível, mas a teleconsulta
  segue normalmente — ele é opcional por projeto."
- Do not restart the API for this; DB-driven features are unaffected.

### MailHog does not open or shows no code

1. `docker compose -f Backend/docker-compose.yml ps` and confirm `digitaly-tmp-mailhog` is up.
2. `docker compose -f Backend/docker-compose.yml logs mailhog`.
3. `docker compose -f Backend/docker-compose.yml restart mailhog`, then refresh
   `http://localhost:8025`.
4. Check that port 8025 is free and that `MAIL_HOST`/`MAIL_PORT` match the compose values
   (`mailhog`/`1025` inside containers, `localhost`/`1025` from the host).
5. If it still fails, skip the OTP beat and demo the **already-seeded** confirmed
   appointment (`a0000000-0000-4000-8000-000000000002`), which needs no new code.

### Demo database is dirty or a booking conflicts

- Reset to the known state:
  `cd Backend && npm run db:reset` (drops and re-applies migrations, then re-runs the
  idempotent seed). Re-open MailHog; old codes are gone.
- The seed uses fixed UUIDs, so re-seeding is deterministic. If teammates share the same
  database, coordinate before resetting.
- If a slot is taken, pick another slot from the availability list; the UI keeps the
  appointment `pending_code` and offers a retry.

### Video/WebRTC fails

- Use both browsers on the same machine first (STUN-only works there).
- Confirm `STUN_URLS` in `Backend/.env`; for restrictive NAT/enterprise networks a TURN
  server is required (set `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`).
- If it still fails, play `docs/screenshots/05-sala-teleconsulta-desktop.png` or the backup
  recording and keep narrating; `Backend/test/realtime.e2e-spec.ts` proves the relay works.

### API is unreachable

- `curl http://localhost:3001/api/health`; if it fails, check the `start:dev` terminal and
  restart. Confirm `.env` has `JWT_SECRET`, `OTP_PEPPER` and `AI_INTERNAL_TOKEN`.
- If the containerized API and the host `start:dev` are both running, stop one — both bind
  port 3001.

### Web app is unreachable

- Fall back to the API-only path below; it demonstrates the whole backend contract with the
  same seed.

---

## Drive it without the UI (API fallback)

If the web app is unavailable, the API alone demonstrates the whole backend path. With the
stack up and `jq` installed:

```bash
API=http://localhost:3001/api

# Patient session
TOKEN=$(curl -s $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"paciente@digitaly.health","password":"Demo@1234"}' | jq -r .tokens.accessToken)

# Doctor directory and availability
curl -s "$API/users/doctors" -H "authorization: Bearer $TOKEN" | jq
curl -s "$API/appointments/doctors/<doctorId>/slots" -H "authorization: Bearer $TOKEN" | jq

# Book a 30-minute weekday slot, then confirm by e-mail code (read it in MailHog)
curl -s $API/appointments -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"doctorId":"<doctorId>","scheduledAt":"<slot startsAt>","preConsult":[{"questionKey":"chief_complaint","answer":"Palpitacoes"}]}' | jq
curl -s -X POST $API/appointments/<appointmentId>/request-code -H "authorization: Bearer $TOKEN" | jq
curl -s -X POST $API/appointments/<appointmentId>/verify-code -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"code":"<code-from-mailhog>"}' | jq

# Doctor session: agenda, overview, start, end, record
DTOKEN=$(curl -s $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"medico@digitaly.health","password":"Demo@1234"}' | jq -r .tokens.accessToken)
curl -s "$API/appointments/doctor" -H "authorization: Bearer $DTOKEN" | jq
curl -s "$API/patients/<patientId>/overview" -H "authorization: Bearer $DTOKEN" | jq
curl -s -X POST $API/appointments/<appointmentId>/consultations/start -H "authorization: Bearer $DTOKEN" | jq
curl -s -X POST $API/consultations/<consultationId>/end -H "authorization: Bearer $DTOKEN" | jq
curl -s $API/records -H "authorization: Bearer $DTOKEN" -H 'content-type: application/json' \
  -d '{"consultationId":"<consultationId>","patientId":"<patientId>","notes":"Consulta de demonstracao","diagnosis":"Hipertensao","prescriptions":["Losartana 50mg"]}' | jq
```

The live version of this contract is always at `http://localhost:3001/docs` when Swagger is
enabled.
