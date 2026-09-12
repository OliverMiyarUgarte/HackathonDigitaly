# Digitaly demo script

Timed, rehearsal-ready script for the hackathon presentation. It covers the happy path
end to end and maps every moment to the official evaluation criteria. Everything tied to
the API is verified against the code in this repository; the browser UI and the Python
copilot are separate services, so actions are described by intent rather than exact button
labels.

Target duration: **7 minutes** (a 5-minute variant is at the end).

---

## Pre-flight checklist

Run through this 15 minutes before going on stage.

- [ ] `docker compose -f Backend/docker-compose.yml ps` shows Postgres healthy, MailHog and
      Adminer up.
- [ ] `cd Backend && npm run db:reset` to reload the fictional seed state (drops and
      re-applies migrations, then re-runs the seed).
- [ ] `npm run start:dev` is up; `curl http://localhost:3001/api/health` returns `status: ok`.
- [ ] `curl http://localhost:3001/api/ready` returns `{"status":"ok","checks":{"database":"up","ai":"up"}}`
      when the copilot is running, or `degraded`/`ai: down` if not (demo still works).
- [ ] Swagger opens at `http://localhost:3001/docs`.
- [ ] MailHog opens at `http://localhost:8025` and shows an empty inbox (or an older code).
- [ ] Two browsers (or a normal + an incognito window) are open: one for the patient, one
      for the doctor. Both logged out.
- [ ] Camera/microphone permission pre-granted in both browsers.
- [ ] A local file to attach (e.g. a small PDF or PNG) is on the desktop.
- [ ] Backup recording of the full flow is ready to play if the network fails.
- [ ] Demo accounts known: `paciente@digitaly.health` / `medico@digitaly.health`,
      password `Demo@1234`.

Presenter/roles: one **narrator**, one **driver** on the keyboard, and optionally one
person playing the patient on the second browser.

---

## Timed script

### 0:00 – 1:00 — Problem and goal (one slide)

**Say (pt-BR):** "No Brasil, conseguir uma consulta com especialista ainda é lento e
fragmentado: agendar é uma coisa, confirmar é outra, atender é outra, e o prontuário fica
em um quarto sistema. O Digitaly junta agendamento, confirmação segura por e-mail,
teleconsulta com vídeo e um copiloto de IA em uma única plataforma. Hoje vamos mostrar o
caminho completo, do agendamento ao prontuário, passando por dados em tempo real."

**Point at the architecture slide** (see the Arquitetura section below): "São quatro
serviços — web, API, copiloto em Python e PostgreSQL — que conversam por um contrato
compartilhado."

### 1:00 – 2:30 — Patient books and confirms

| # | Screen | Action | Evidence (API behind it) |
| --- | --- | --- | --- |
| 1 | Login | Log in as `paciente@digitaly.health` | `POST /api/auth/login` → JWT + rotating refresh token |
| 2 | Doctor list | Filter by specialty or name | `GET /api/users/doctors?specialty=Cardiologia` |
| 3 | Booking | Pick a weekday 30-minute slot, answer the pre-consult questions, confirm | `GET /api/appointments/doctors/{id}/slots`, `POST /api/appointments` → `pending_code` |
| 4 | Confirm | Click "enviar código" | `POST /api/appointments/{id}/request-code` → 6-digit code e-mailed |
| 5 | MailHog | Open `http://localhost:8025` and show the e-mail is real | MailHog message with subject `Seu código de validação — Digitaly Telemedicine` |
| 6 | Confirm | Type the code and confirm | `POST /api/appointments/{id}/verify-code` → `confirmed` |
| 7 | Calendar | Show the appointment in the patient calendar | `GET /api/appointments/calendar` |

**Say (pt-BR):** "O agendamento nasce como `pending_code`. O código de seis dígitos não é
gravado: guardamos só o hash HMAC-SHA256, com prazo de dez minutos e limite de tentativas.
A confirmação é transacional e só acontece uma vez. Reparem que o e-mail chegou de
verdade no MailHog — em produção é o provedor de e-mail."

**Don't say** "we wrote everything by hand" — be accurate about AI-assisted generation
(see Entendimento do código).

### 2:30 – 4:30 — Doctor reviews and starts the consultation

| # | Screen | Action | Evidence |
| --- | --- | --- | --- |
| 8 | Doctor login | Switch browser, log in as `medico@digitaly.health` | Role guard restricts these routes to `doctor` |
| 9 | Agenda | Show the day agenda; the new booking appears with the pre-consult flag | `GET /api/appointments/doctor` → `DoctorAppointmentDto.hasPreConsult` |
| 10 | Patient overview | Open the patient; show profile, upcoming appointment, history; open the booking's pre-consult | `GET /api/patients/{patientId}/overview` → `PatientOverviewDto` (pre-consult of the soonest upcoming appointment) and `GET /api/appointments/{id}/pre-consult` (this appointment) |
| 11 | Start | Click "iniciar teleconsulta" | `POST /api/appointments/{id}/consultations/start` → `active`, room id, ICE servers |
| 12 | Patient browser | Show the real-time notification and the patient joining | `consultation.started` emitted to the appointment room **and** the patient's user room |

**Say (pt-BR):** "Antes de atender, a médica vê a queixa principal, a duração dos sintomas,
os medicamentos e as alergias que o paciente respondeu no agendamento. Ao iniciar, o
prontuário da consulta é criado e o paciente recebe uma notificação em tempo real — mesmo
que não esteja na sala ainda, porque o evento é emitido para a sala pessoal dele. O
`start` é idempotente e protegido por transação: não existe consulta duplicada."

### 4:30 – 6:00 — Video, attachment, AI copilot, end and record

| # | Screen | Action | Evidence |
| --- | --- | --- | --- |
| 13 | Video room | Both join; show mic and camera | Socket.IO `/realtime`: `room.join`, `room.joined`, `participant.joined`, `webrtc.offer/answer/ice`, `media.state` |
| 14 | Attachment | Doctor uploads the file | `POST /api/appointments/{id}/attachments` (PDF/PNG/JPEG/WebP/TXT, ≤ 10 MiB); download streams bytes with `nosniff` |
| 15 | Copilot panel | Speak; show partial/final transcript and feedback appear only on the doctor's screen | `audio.chunk` → API → Python WS; `transcript.partial`, `transcript.final`, `copilot.feedback` relayed to the doctor's user room only |
| 16 | End | Doctor ends the consultation | `POST /api/consultations/{id}/end` → `ended`; `consultation.ended`; AI session closed |
| 17 | Record | Write notes, diagnosis and prescriptions | `POST /api/records` (doctor-only, one record per consultation) |

**Say (pt-BR):** "A sinalização WebRTC passa pelo mesmo canal autenticado, então o
navegador nunca vê o token interno do copiloto. O áudio vai do navegador para a API e a
API repassa para o serviço Python; a transcrição e os alertas voltam só para a médica.
Se o copiloto cair, a consulta continua: aparece o estado `ai.status: indisponível`. No
fim, a médica encerra e escreve o prontuário, que fica auditado."

### 6:00 – 7:00 — Architecture, infra and LGPD closing (one or two slides)

**Say (pt-BR):** "A arquitetura são quatro serviços com um contrato único: os mesmos tipos
TypeScript, o OpenAPI e os eventos Socket.IO valem para a web, a API e o copiloto. A API é
um monólito modular com módulos de domínio, guardas globais e validação em toda fronteira.
Na operação, `/health` é liveness e `/ready` verifica Postgres e o copiloto: banco fora
retorna 503, copiloto fora retorna degradado sem derrubar a consulta. Tudo é auditado e
não gravamos PII, códigos nem transcrições em log. Os dados de demonstração são fictícios,
como manda a LGPD para dados de saúde."

Closing line: "Digitaly: agendamento, confirmação segura, teleconsulta e copiloto — em um
contrato só."

---

## Compressed 5-minute variant

Keep the same order, cut here:

- Drop the doctor's pre-consult detail (step 10) to one sentence.
- Skip the attachment upload or show it without narrating storage.
- Skip the record form and just state "the record is saved and audited".
- Keep the OTP-in-MailHog moment and the real-time notification — they are the strongest
  beats.

---

## Evaluation criteria mapping

### Arquitetura

**Show:** the service diagram (README) plus `service-contracts/` and `Backend/src/`.

*Concrete evidence*

- Four services with one contract package: `types/` (REST DTOs), `events/` (Socket.IO
  maps and Nest↔Python frames), `http/openapi.yaml` (OpenAPI 3.1) and
  `python/contracts.py` (Pydantic v2 mirror), versioned in `CHANGELOG.md`.
- The API is a modular monolith: `app.module.ts` wires domain modules, and global
  `JwtAuthGuard`, `RolesGuard`, `HttpExceptionFilter`, `CorrelationIdInterceptor` and
  `LoggingInterceptor` apply everywhere. DTO classes implement the shared contract types and
  are validated with `class-validator`; there is no `any` in the shared contracts.
- **Defensible tradeoff (say this):** audio goes *browser → Nest → Python* instead of the
  browser talking to Python directly. The browser only ever holds the user's JWT; the
  `X-Internal-Token` and the per-consultation ownership check stay server-side, and the
  copilot is optional. The cost is one extra hop and the API holding the session — worth it
  for a single authenticated, auditable boundary.

### Infra conceitual

**Show:** `Backend/docker-compose.yml`, `Backend/Dockerfile`, `docs/operations.md`.

*Concrete evidence*

- Local stack on isolated ports: Postgres 5433, MailHog 1025/8025, Adminer 8081, API 3001,
  distinct `digitaly-tmp-*` container names and named volumes; dependencies bound to
  `127.0.0.1` so demo PHI is not network-exposed.
- Multi-stage, non-root (`nestjs`) runtime image with a Docker healthcheck hitting
  `/api/health`; migrations run from the host because the runtime image has no Prisma CLI.
- `GET /api/health` is liveness (always 200 while the process responds); `GET /api/ready`
  checks Postgres (`SELECT 1`) and the AI `/health`. Database down → **503**; AI down →
  **200 `degraded`** because a consultation must work without transcription.
- Observability: `x-correlation-id` on every request, structured logs (method, path, status,
  latency, actor id), audit rows and the metrics list in `docs/operations.md` (§4).
- Conceptual production topology: stateless web/API/AI behind a load balancer, managed
  Postgres with PITR, private object storage for PHI, Redis Socket.IO adapter for
  multi-instance fan-out, TURN for restrictive networks, secrets from a secret manager.

### UI/UX

**Show:** the patient flow and the doctor flow side by side.

*Concrete evidence*

- Two clear personas with different information hierarchies: `/api/appointments/calendar`
  returns compact `CalendarEntryDto` with a `counterpart` and `isCurrent` for the patient;
  `/api/appointments/doctor` returns an agenda with `hasPreConsult`; and the doctor's
  `GET /api/patients/{id}/overview` aggregates profile, the soonest upcoming appointment,
  recent history and that appointment's pre-consult in one payload; the per-appointment
  `GET /api/appointments/{id}/pre-consult` covers any specific booking.
- Contextual polish: pre-consult is requested at booking and surfaced before the consult;
  the patient gets `consultation.started` even before opening the room; attachment metadata
  carries a ready-to-use `downloadUrl`; errors are consistent and human-mappable thanks to
  stable `ErrorCode`s.
- Note that the Next.js UI is a separate service; the API shapes above are what make the two
  personas feel focused. Be honest about which UI details are out of scope for this repo.

### Apresentação

- Rehearse the exact path twice with the driver; own the timing table above.
- Keep the two-browser setup running before you start talking.
- Use the fallbacks instead of debugging live. A calm fallback beats a frozen demo.
- Alternate speakers by module so it is clear the team understands the code (next section).

### Entendimento do código

Use [`docs/what-changed.md`](what-changed.md) as the running note. For each theme, one
teammate says: *what it does → why it exists → what the AI generated → what I personally
reviewed or changed*. Suggestions:

| Theme | Owner should be able to explain |
| --- | --- |
| Contracts | How a payload change flows through types, OpenAPI, Pydantic and both services |
| Data layer | Prisma models, indexes, why enums mirror the contracts, the fictional seed |
| Auth | argon2id, JWT access + opaque rotating refresh tokens, role guards, throttling |
| Booking + OTP | Advisory-lock race safety, HMAC code hashing, expiry and attempt cap |
| Realtime | JWT handshake, appointment vs user rooms, presence, signaling relay |
| Consultations | Transactional start/end, idempotency, notifications, AI session lifecycle |
| Records | Role-scoped reads, one record per consultation, pre-consult upsert |
| Attachments | Storage abstraction, traversal safety, size/type allowlist, streaming |
| AI proxy | Buffered frames, timeouts, doctor-only feedback, graceful degradation |
| Ops / hardening / audit | Readiness semantics, correlation id, sanitized audit, dependency patches |

**Be explicit about AI generation (say this):** "We used an AI coding agent to generate the
implementation commit by commit. Each commit was reviewed and then hardened by follow-up
commits — for example the refresh-token reuse fix, the booking/OTP race fix, the users
alignment and the dependency patches. The human decisions were the contracts, module
boundaries, security constraints and the demo narrative; the AI wrote the bulk of the code.
`docs/what-changed.md` records this per theme and points to the commits."

---

## pt-BR narration lines

Use these as written; they are product-facing and can be read aloud.

- "Vou entrar como paciente." / "Agora entro como médica."
- "Escolho a Dra. Helena, especialidade Cardiologia."
- "Seleciono um horário de trinta minutos em um dia de semana e respondo as perguntas do
  pré-atendimento: queixa principal, duração dos sintomas, medicamentos, alergias e
  histórico."
- "Ao confirmar, o agendamento fica pendente até a validação por e-mail."
- "Aqui está o e-mail com o código de seis dígitos; vou digitá-lo para confirmar."
- "Agora a consulta aparece na minha agenda."
- "A médica vê o resumo do paciente e o pré-atendimento antes de iniciar."
- "Iniciando a teleconsulta. O paciente recebe a notificação em tempo real e entra na sala."
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
  `{"status":"degraded","checks":{"database":"up","ai":"down"}}` and the doctor's socket
  receives `ai.status: "unavailable"`.
- Say: "O copiloto está indisponível, mas a teleconsulta segue normalmente — ele é
  opcional por projeto." Then play the recorded copilot clip if you want to show the panel.
- Do not restart the whole API for this; DB-driven features are unaffected.

### Demo database is dirty or a booking conflicts

- Reset to the known state:
  `cd Backend && npm run db:reset` (drops and re-applies migrations, then re-runs the
  idempotent seed). Re-open MailHog; old codes are gone.
- The seed uses fixed UUIDs, so re-seeding is deterministic. If teammates share the same
  database, coordinate before resetting.
- If a slot is taken, pick another slot from the availability list.

### MailHog does not open or shows no code

1. `docker compose -f Backend/docker-compose.yml ps` and confirm `digitaly-tmp-mailhog` is up.
2. `docker compose -f Backend/docker-compose.yml logs mailhog`.
3. `docker compose -f Backend/docker-compose.yml restart mailhog`, then refresh
   `http://localhost:8025`.
4. Check that port 8025 is free and that `MAIL_HOST`/`MAIL_PORT` match the compose values
   (`mailhog`/`1025` inside containers, `localhost`/`1025` from the host).
5. If the code was already consumed, request/resend it from the appointment screen; the
   previous code is invalidated.

### Video/WebRTC fails

- Use both browsers on the same machine first (STUN-only works there).
- Confirm `STUN_URLS` in `.env`; for restrictive NAT/enterprise networks a TURN server is
  required (set `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`).
- If it still fails, play the backup recording and keep narrating; the API/signaling tests
  (`Backend/test/realtime.e2e-spec.ts`) prove the relay works.

### API is unreachable

- `curl http://localhost:3001/api/health`; if it fails, check the `start:dev` terminal and
  restart. Confirm `.env` has `JWT_SECRET`, `OTP_PEPPER` and `AI_INTERNAL_TOKEN`.
- If the containerized API and the host `start:dev` are both running, stop one — both bind
  port 3001.

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

The live version of this contract is always at `http://localhost:3001/docs`.
