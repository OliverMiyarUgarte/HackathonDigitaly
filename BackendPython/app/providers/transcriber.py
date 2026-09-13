from __future__ import annotations

import asyncio
import io
import wave
from collections.abc import Sequence
from typing import Protocol

import httpx
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


class OpenAITranscriber:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str = "whisper-1",
        timeout_seconds: float = 30.0,
        language: str = "pt",
    ) -> None:
        self.name = f"openai-stt:{model}"
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout_seconds
        self._language = language

    async def transcribe(self, samples: np.ndarray, sample_rate: int) -> str:
        if samples.size == 0:
            return ""
        if sample_rate != WHISPER_SAMPLE_RATE:
            raise TranscriptionError("openai transcription requires 16000 Hz mono audio")
        wav_bytes = encode_wav(samples, WHISPER_SAMPLE_RATE)
        return await self._request(wav_bytes)

    async def _request(self, wav_bytes: bytes) -> str:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    f"{self._base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    data={
                        "model": self._model,
                        "language": self._language,
                        "response_format": "json",
                    },
                    files={"file": ("consultation.wav", wav_bytes, "audio/wav")},
                )
                response.raise_for_status()
                body: object = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise TranscriptionError("speech-to-text provider failed") from exc
        return _extract_transcript(body)


def encode_wav(samples: np.ndarray, sample_rate: int, channels: int = 1) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(_samples_to_pcm16(samples))
    return buffer.getvalue()


def _samples_to_pcm16(samples: np.ndarray) -> bytes:
    if samples.size == 0:
        return b""
    if np.issubdtype(samples.dtype, np.integer):
        return np.clip(samples, -32768, 32767).astype("<i2", copy=False).tobytes()
    floats = samples.astype(np.float32, copy=False)
    scaled = np.rint(np.clip(floats, -1.0, 1.0) * 32767.0)
    return scaled.astype("<i2", copy=False).tobytes()


def _extract_transcript(body: object) -> str:
    if not isinstance(body, dict):
        raise TranscriptionError("speech-to-text response malformed")
    text = body.get("text")
    if not isinstance(text, str):
        raise TranscriptionError("speech-to-text response malformed")
    return text.strip()


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
