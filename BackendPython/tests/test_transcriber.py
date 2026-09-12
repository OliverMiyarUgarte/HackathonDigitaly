from __future__ import annotations

import numpy as np

from app.providers.transcriber import FakeTranscriber, TranscriptionError, WhisperTranscriber


async def test_fake_transcriber_is_deterministic() -> None:
    transcriber = FakeTranscriber()
    samples = np.zeros(16_000, dtype="<i2")
    first = await transcriber.transcribe(samples, 16_000)
    second = await transcriber.transcribe(samples, 16_000)
    assert first == second
    assert "dor no peito" in first
    assert "falta de ar" in first


async def test_fake_transcriber_empty_audio() -> None:
    transcriber = FakeTranscriber()
    assert await transcriber.transcribe(np.empty(0, dtype="<i2"), 16_000) == ""


async def test_fake_transcriber_growing_window() -> None:
    transcriber = FakeTranscriber(words_per_call=3)
    samples = np.zeros(16_000, dtype="<i2")
    first = await transcriber.transcribe(samples, 16_000)
    second = await transcriber.transcribe(samples, 16_000)
    assert first == "Paciente relata dor"
    assert second.startswith(first)


async def test_whisper_requires_16khz() -> None:
    transcriber = object.__new__(WhisperTranscriber)
    transcriber.name = "whisper:test"
    transcriber._backend = "openai"
    transcriber._model = None
    try:
        await transcriber.transcribe(np.zeros(10, dtype="<i2"), 8_000)
    except TranscriptionError:
        return
    raise AssertionError("expected TranscriptionError")
