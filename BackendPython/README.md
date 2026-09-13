# Digitaly AI copilot (FastAPI)

Streaming transcription and real-time copilot feedback for teleconsultations.
The service consumes PCM audio over WebSocket and pushes transcript and feedback
frames to the NestJS proxy, which relays them to the doctor panel.

## Endpoints

| Method | Path | Auth | Contract |
| --- | --- | --- | --- |
| `GET` | `/health` | none | `AiHealthDto` `{ status, provider, timestamp }` |
| `POST` | `/sessions` | `X-Internal-Token` | `CreateAiSessionRequestDto` -> `AiSessionCreatedDto` |
| `WS` | `/sessions/{sessionId}/audio` | `X-Internal-Token` | `AiClientFrame` -> `AiServerFrame` |

Rejections: HTTP `401` on `/sessions`, WebSocket close `4401` (bad token),
`4404` (unknown session), `4408` (expired or idle).

## Run locally

```bash
cd BackendPython
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --env-file .env
```

The default `AI_PROVIDER=fake` runs fully offline with `FakeTranscriber` + `RuleCopilot`.

For real local speech-to-text, install the optional Whisper backend. It is kept
out of the default image, so add it only where STT is needed:

```bash
pip install -r requirements-whisper.txt   # or: pip install ".[local]"
```

`AI_PROVIDER=local` uses `WhisperTranscriber` (`faster-whisper` preferred, then
`openai-whisper`). Without an installed engine the service logs a clear warning at
startup, falls back to `FakeTranscriber`, and `/health` reports `fake+rule`.

Stream a WAV file through the contract with the dev client:

```bash
python scripts/dev_ws_client.py path/to/audio.wav \
  --token "$AI_INTERNAL_TOKEN"
```

## Providers

`AI_PROVIDER` selects the stack. `Transcriber` and `Copilot` are interfaces, so
the pipeline never depends on a concrete provider.

| `AI_PROVIDER` | Transcription | Copilot | External calls |
| --- | --- | --- | --- |
| `fake` | `FakeTranscriber` | `RuleCopilot` | none |
| `local` | `WhisperTranscriber` (`faster-whisper` then `openai-whisper`); `FakeTranscriber` with health `fake+rule` if no engine | `RuleCopilot` | none |
| `openai` | `WhisperTranscriber` when a model is installed | `LlmCopilot` when `OPENAI_API_KEY` is set, else `RuleCopilot` | OpenAI chat completions |

`WhisperTranscriber` transcribes the in-memory `numpy` buffer directly, so no
temporary audio files are written.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `fake` | `fake`, `local` or `openai` |
| `OPENAI_API_KEY` | empty | Enables `LlmCopilot` |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | LLM endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | Chat model |
| `WHISPER_MODEL` | `base` | Whisper model name |
| `AI_INTERNAL_TOKEN` | empty | Shared secret with NestJS; empty rejects everything |
| `SESSION_TTL_SECONDS` | `900` | Idle timeout |
| `MAX_BUFFER_BYTES` | `1920000` | Hard per-session audio cap (~60 s of 16 kHz mono) |
| `PARTIAL_INTERVAL_SECONDS` | `2.5` | Buffered audio per partial re-transcription |
| `LOG_LEVEL` | `INFO` | Log level |

No secret is hardcoded. `.env` is ignored by git and Docker.

## Frame flow

1. `POST /sessions` stores an in-memory session bound to the consultation.
2. The client streams `audio.chunk` frames (`pcm_s16le`, 16 kHz, mono, base64).
3. Every `PARTIAL_INTERVAL_SECONDS` of buffered audio, the rolling window is
   re-transcribed and emitted as `transcript.partial`.
4. On `audio.end`, the buffer is transcribed once more as `transcript.final`,
   then `RuleCopilot`/`LlmCopilot` emits `copilot.feedback` items with severity
   and tags (`red_flag`, `chest_pain`, `dyspnea`, `medication`, `allergy`).
   `audio.end` only finalizes the current buffer; it keeps the session open, so a
   later `audio.chunk` with a higher `seq` resumes streaming without a new session.
5. `session.close` (or the idle sweeper) tears the session down. Provider errors
   are translated to `error` frames and the socket stays open when possible.

Late or duplicate `seq` values are dropped. Buffer overflow drops the oldest
bytes and emits `error` with code `BUFFER_TRUNCATED`. Unsupported `sampleRate` or
a non-mono `channels` value is rejected (`UNSUPPORTED_AUDIO` or
`VALIDATION_FAILED`); malformed frames emit `VALIDATION_FAILED`. The buffer
is capped at `MAX_BUFFER_BYTES`.

## Contracts

`app/models.py` mirrors `service-contracts/python/contracts.py` and
`service-contracts/events/ai-events.ts`. The service is self-contained for the
Docker build, and `tests/test_contracts.py` loads the shared `contracts.py` and
asserts field-name, required-field, field-annotation, enum and frame-variant
parity, so dtype drift fails the test suite. NestJS calls exactly the endpoints
listed above.

`AiAudioChunkFrame.channels` is the contract literal `1` (`Literal[1]`), so a
non-mono frame is rejected by validation as `VALIDATION_FAILED`. All other frame
fields match the contract exactly.

## Tests

```bash
pip install -r requirements.txt
ruff format --check .
ruff check .
pytest
```

All tests use the fake providers. No network access and no model download.

## Docker

```bash
docker build -t digitaly-ai .
docker run --rm -p 8000:8000 --env-file .env digitaly-ai
```

Runs as a non-root user and exposes the `/health` healthcheck.

## LGPD

- Audio and transcripts stay in memory only. Nothing is persisted to disk or a
  database, and Whisper receives a `numpy` array rather than a temp file.
- Buffers are bounded and cleared on `audio.end`, `session.close`, idle timeout
  and shutdown. Sessions are ephemeral.
- Tokens and transcripts are never logged. Errors report codes, not content.
- Third-party STT/LLM providers (`local`/`openai`) are operators: enable them
  only with a documented legal basis and a data processing agreement. The
  `fake`/`rule` path keeps the demo entirely on-host.
