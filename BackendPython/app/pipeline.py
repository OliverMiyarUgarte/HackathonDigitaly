from __future__ import annotations

import asyncio
import logging
from uuid import uuid4

from fastapi import WebSocket
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from app.audio import AudioDecodeError, decode_base64_bytes
from app.config import Settings
from app.models import (
    CLIENT_FRAME_ADAPTER,
    AiAudioChunkFrame,
    AiAudioEndFrame,
    AiClientFrame,
    AiCopilotFeedbackFrame,
    AiErrorFrame,
    AiSessionCloseFrame,
    AiTranscriptFinalFrame,
    AiTranscriptPartialFrame,
)
from app.providers.copilot import Copilot
from app.providers.transcriber import Transcriber, TranscriptionError
from app.session import Session, iso_timestamp

logger = logging.getLogger("digitaly.ai.pipeline")

_BYTES_PER_SAMPLE = 2


async def run_audio_session(
    session: Session,
    websocket: WebSocket,
    settings: Settings,
    transcriber: Transcriber,
    copilot: Copilot,
) -> None:
    session.websocket = websocket
    session.touch()
    try:
        while not session.closed:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break
            frame = _parse_frame(raw)
            if frame is None:
                await _send_error(session, "VALIDATION_FAILED", "Frame inválido para o contrato.")
                continue
            if isinstance(frame, AiAudioChunkFrame):
                await _handle_chunk(session, frame, settings, transcriber)
            elif isinstance(frame, AiAudioEndFrame):
                await _finalize(session, settings, transcriber, copilot)
            elif isinstance(frame, AiSessionCloseFrame):
                session.closed = True
    finally:
        await _cancel_partial(session)
        session.websocket = None


def _parse_frame(raw: str) -> AiClientFrame | None:
    try:
        return CLIENT_FRAME_ADAPTER.validate_json(raw)
    except ValidationError:
        return None


async def _handle_chunk(
    session: Session,
    frame: AiAudioChunkFrame,
    settings: Settings,
    transcriber: Transcriber,
) -> None:
    if (
        frame.sampleRate != settings.target_sample_rate
        or frame.channels != settings.target_channels
    ):
        await _send_error(session, "UNSUPPORTED_AUDIO", "Esperado pcm_s16le 16000 Hz mono.")
        return
    if frame.seq <= session.last_seq:
        return
    session.last_seq = frame.seq
    try:
        raw = decode_base64_bytes(frame.data)
    except AudioDecodeError:
        await _send_error(session, "INVALID_AUDIO", "Chunk de áudio inválido.")
        return

    session.buffer.append(raw)
    if session.buffer.acknowledge_truncation():
        await _send_error(
            session,
            "BUFFER_TRUNCATED",
            "Limite de buffer atingido. O áudio mais antigo foi descartado.",
        )
    session.bytes_since_partial += len(raw)
    session.touch()
    _maybe_start_partial(session, settings, transcriber)


def _maybe_start_partial(
    session: Session,
    settings: Settings,
    transcriber: Transcriber,
) -> None:
    threshold = int(
        settings.partial_interval_seconds
        * settings.target_sample_rate
        * settings.target_channels
        * _BYTES_PER_SAMPLE
    )
    if session.bytes_since_partial < threshold or session.partial_busy:
        return
    session.bytes_since_partial = 0
    session.partial_busy = True
    session.partial_task = asyncio.create_task(_emit_partial(session, settings, transcriber))


async def _finalize(
    session: Session,
    settings: Settings,
    transcriber: Transcriber,
    copilot: Copilot,
) -> None:
    await _cancel_partial(session)
    samples = session.buffer.snapshot()
    session.buffer.clear()
    session.bytes_since_partial = 0
    session.touch()
    if samples.size == 0:
        return
    try:
        text = await transcriber.transcribe(samples, settings.target_sample_rate)
    except TranscriptionError:
        await _send_error(session, "TRANSCRIPTION_FAILED", "Falha na transcrição final.")
        return
    if not text:
        return
    await session.send(
        AiTranscriptFinalFrame(
            type="transcript.final",
            segmentId=uuid4().hex,
            text=text,
            at=iso_timestamp(),
        )
    )
    try:
        items = await copilot.feedback(text)
    except Exception:
        logger.exception("copilot feedback failed")
        await _send_error(session, "COPILOT_FAILED", "Falha ao gerar sugestões.")
        return
    for item in items:
        await session.send(
            AiCopilotFeedbackFrame(
                type="copilot.feedback",
                severity=item.severity,
                message=item.message,
                at=iso_timestamp(),
                tags=list(item.tags),
            )
        )


async def _emit_partial(
    session: Session,
    settings: Settings,
    transcriber: Transcriber,
) -> None:
    session.partial_busy = True
    try:
        samples = session.buffer.snapshot()
        if samples.size == 0:
            return
        text = await transcriber.transcribe(samples, settings.target_sample_rate)
        if not text:
            return
        await session.send(
            AiTranscriptPartialFrame(
                type="transcript.partial",
                text=text,
                at=iso_timestamp(),
            )
        )
    except TranscriptionError:
        await _send_error(session, "TRANSCRIPTION_FAILED", "Falha na transcrição parcial.")
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("partial transcription failed")
        await _send_error(session, "TRANSCRIPTION_FAILED", "Falha na transcrição parcial.")
    finally:
        session.partial_busy = False


async def _cancel_partial(session: Session) -> None:
    task = session.partial_task
    session.partial_task = None
    if task is None:
        return
    if not task.done():
        task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        return
    except Exception:
        logger.exception("partial task failed")


async def _send_error(session: Session, code: str, message: str) -> None:
    await session.send(AiErrorFrame(type="error", code=code, message=message, at=iso_timestamp()))
