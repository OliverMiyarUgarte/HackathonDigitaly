# Digitaly web (Next.js)

Patient and doctor UI for the Digitaly teleconsultation platform: booking and confirmation,
calendars, the patient overview, the teleconsultation room (WebRTC + copilot panel) and the
medical-record closing form.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 and Socket.IO.
The UI follows the Digitaly design system vendored in [`../docs/design-system.md`](../docs/design-system.md);
tokens live in `app/globals.css` and the component library in `components/ui/`.

See the [root README](../README.md) for the platform, and
[`../docs/demo-script.md`](../docs/demo-script.md) for the end-to-end demo path.

## Prerequisites

- Node.js 22+ and npm
- The API running at `http://localhost:3001` (see [`../Backend/README.md`](../Backend/README.md))
- Optional: the AI copilot at `http://localhost:8000`; without it the room shows
  `Copiloto indisponível` and the call still works

## Environment

```bash
cp .env.example .env
```

| Variable | Example | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | API base URL |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` | Socket.IO origin (namespace `/realtime`) |
| `NEXT_PUBLIC_MAILHOG_URL` | `http://localhost:8025` | Optional; shows the MailHog link on the confirmation screen |

`next.config.ts` falls back to the same local defaults when the variables are unset. The
production values are injected as build args in `docker-compose.prod.yml`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build / run (standalone output) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run test:e2e` | Playwright suite (25 tests in 5 files) |
| `npm run screenshots` | Regenerate `../docs/screenshots/` |

## Routes

| Route | Persona | Screen |
| --- | --- | --- |
| `/entrar`, `/registro`, `/recuperar-senha` | public | Auth (legacy `/auth/*` and `/dashboard` redirect here) |
| `/paciente` | patient | Home: next appointment, quick actions, recent consults |
| `/paciente/agendar` | patient | Four-step booking wizard |
| `/paciente/confirmar-agendamento` | patient | 6-digit e-mail code confirmation |
| `/paciente/calendario`, `/paciente/historico`, `/paciente/prontuario` | patient | Calendar, history, records |
| `/paciente/consultas/[consultationId]` | patient | Teleconsultation room / post-call summary |
| `/medico`, `/medico/atendimentos` | doctor | Home and filterable agenda |
| `/medico/pacientes/[patientId]` | doctor | Patient overview, pre-consult, history |
| `/medico/consultas/[consultationId]` | doctor | Room with the copilot panel |
| `/medico/consultas/[consultationId]/fechamento` | doctor | Medical-record closing form |
| `/medico/prontuario` | doctor | Records history |

Route shells enforce the role client-side (`RequireRole`); the API enforces authorization on
every request and socket handshake.

## Realtime and audio

- The client connects to the Socket.IO namespace `/realtime` with the access token and joins
  an appointment room; notifications (`consultation.started` / `consultation.ended`) also
  arrive through the user's room.
- WebRTC offer/answer/ICE is relayed through the API; media flows peer to peer.
- Only the doctor streams audio to the copilot: microphone audio is encoded as
  `pcm_s16le`, 16 kHz, mono by `lib/realtime/pcm.ts` and `public/worklets/`, then sent as
  `audio.chunk` frames.

## Tests

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Playwright requires the seeded database, the API on `:3001` and the web app on `:3000`; its
`webServer` config starts `npm run dev` automatically. `e2e/global-setup.ts` logs in the four
seeded accounts and stores their sessions. The suite runs with one worker because it mutates
the shared seed and the media room.

## Deploy

The production image is a multi-stage standalone Next build run as a non-root user. In the
single-VPS stack it is built by `docker-compose.prod.yml` and reached only through Caddy; see
[`../docs/deploy-vps.md`](../docs/deploy-vps.md).
