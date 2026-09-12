from __future__ import annotations

import asyncio
from collections.abc import Sequence
from typing import Protocol

import numpy as np

WHISPER_SAMPLE_RATE = 16_000


class TranscriptionError(RuntimeError):
    pass


class Transcriber(Protocol):
    name: str

    async def transcribe(self, samples: np.ndarray, sample_rate: int) -> str: ...


class FakeTranscriber:
    name = "fake"

    def __init__(
        self,
        phrase: Sequence[str] | None = None,
        words_per_call: int | None = None,
    ) -> None:
        self._words: tuple[str, ...] = (
            tuple(phrase)
            if phrase
            else (
                "Paciente",
                "relata",
                "dor",
                "no",
                "peito",
                "e",
                "falta",
                "de",
                "ar",
                "desde",
                "ontem",
            )
        )
        self._words_per_call = words_per_call
        self._calls = 0

    async def transcribe(self, samples: np.ndarray, sample_rate: int) -> str:
        if samples.size == 0:
            return ""
        self._calls += 1
        if self._words_per_call is None:
            return " ".join(self._words)
        count = min(len(self._words), self._calls * max(1, self._words_per_call))
        return " ".join(self._words[:count])


class WhisperTranscriber:
    def __init__(
        self,
        model_name: str,
        device: str = "cpu",
        compute_type: str = "int8",
    ) -> None:
        self.name = f"whisper:{model_name}"
        self._backend, self._model = _load_whisper(model_name, device, compute_type)

    async def transcribe(self, samples: np.ndarray, sample_rate: int) -> str:
        if samples.size == 0:
            return ""
        if sample_rate != WHISPER_SAMPLE_RATE:
            raise TranscriptionError("whisper requires 16000 Hz mono audio")
        return await asyncio.to_thread(self._transcribe_sync, samples)

    def _transcribe_sync(self, samples: np.ndarray) -> str:
        try:
            if self._backend == "faster":
                segments, _info = self._model.transcribe(samples, language="pt", vad_filter=True)
                return " ".join(segment.text.strip() for segment in segments).strip()
            result = self._model.transcribe(samples, fp16=False, language="pt")
            return str(result.get("text", "")).strip()
        except Exception as exc:
            raise TranscriptionError("speech-to-text provider failed") from exc


def _load_whisper(model_name: str, device: str, compute_type: str) -> tuple[str, object]:
    try:
        from faster_whisper import WhisperModel

        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        return "faster", model
    except Exception:
        pass
    try:
        import whisper

        model = whisper.load_model(model_name)
        return "openai", model
    except Exception as exc:
        raise TranscriptionError("no whisper backend available") from exc
