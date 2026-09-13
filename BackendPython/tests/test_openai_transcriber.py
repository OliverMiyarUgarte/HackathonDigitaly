from __future__ import annotations

import io
import wave
from typing import Any

import httpx
import numpy as np
import pytest

from app.providers.transcriber import (
    OpenAITranscriber,
    TranscriptionError,
    encode_wav,
)


def _transcriber() -> OpenAITranscriber:
    return OpenAITranscriber(
        api_key="sk-test",
        base_url="https://api.openai.com/v1",
        model="whisper-1",
        timeout_seconds=12.0,
    )


def test_encode_wav_header_and_data_length() -> None:
    samples = np.linspace(-1.0, 1.0, 1600, dtype="<f4")
    data = encode_wav(samples, 16_000)
    assert data[:4] == b"RIFF"
    assert data[8:12] == b"WAVE"
    assert data[12:16] == b"fmt "
    assert data[36:40] == b"data"
    assert int.from_bytes(data[40:44], "little") == samples.size * 2
    with wave.open(io.BytesIO(data), "rb") as wav_file:
        assert wav_file.getnchannels() == 1
        assert wav_file.getsampwidth() == 2
        assert wav_file.getframerate() == 16_000
        assert wav_file.getnframes() == samples.size


def test_encode_wav_preserves_pcm_int16() -> None:
    samples = np.array([0, 32767, -32768, 1], dtype="<i2")
    data = encode_wav(samples, 16_000)
    with wave.open(io.BytesIO(data), "rb") as wav_file:
        assert wav_file.readframes(samples.size) == samples.tobytes()


class _StubResponse:
    def __init__(self, payload: object, status_code: int = 200) -> None:
        self._payload = payload
        self._status_code = status_code

    def raise_for_status(self) -> None:
        if self._status_code < 400:
            return
        request = httpx.Request("POST", "https://api.openai.com/v1/audio/transcriptions")
        response = httpx.Response(self._status_code, request=request)
        raise httpx.HTTPStatusError("provider error", request=request, response=response)

    def json(self) -> object:
        return self._payload


def _install_stub(monkeypatch: pytest.MonkeyPatch, response: _StubResponse) -> dict[str, Any]:
    captured: dict[str, Any] = {}

    class StubClient:
        def __init__(self, **kwargs: object) -> None:
            captured["timeout"] = kwargs.get("timeout")

        async def __aenter__(self) -> StubClient:
            return self

        async def __aexit__(self, *args: object) -> bool:
            return False

        async def post(self, url: str, **kwargs: object) -> _StubResponse:
            captured["url"] = url
            captured["headers"] = kwargs.get("headers")
            captured["data"] = kwargs.get("data")
            captured["files"] = kwargs.get("files")
            return response

    monkeypatch.setattr(httpx, "AsyncClient", StubClient)
    return captured


async def test_transcribe_posts_multipart_and_returns_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_stub(monkeypatch, _StubResponse({"text": "  paciente relata dor  "}))
    text = await _transcriber().transcribe(np.zeros(1600, dtype="<f4"), 16_000)

    assert text == "paciente relata dor"
    assert captured["url"] == "https://api.openai.com/v1/audio/transcriptions"
    assert captured["timeout"] == 12.0
    assert captured["headers"] == {"Authorization": "Bearer sk-test"}
    assert captured["data"] == {
        "model": "whisper-1",
        "language": "pt",
        "response_format": "json",
    }
    file_part = captured["files"]["file"]
    assert file_part[0] == "consultation.wav"
    assert file_part[1][:4] == b"RIFF"
    assert file_part[2] == "audio/wav"


async def test_transcribe_accepts_pcm_int16(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _install_stub(monkeypatch, _StubResponse({"text": "ok"}))
    samples = np.array([0, 100, -100, 32767], dtype="<i2")
    assert await _transcriber().transcribe(samples, 16_000) == "ok"
    wav_bytes = captured["files"]["file"][1]
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        assert wav_file.getnframes() == samples.size
        assert wav_file.readframes(samples.size) == samples.tobytes()


async def test_transcribe_http_error_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_stub(monkeypatch, _StubResponse({"text": ""}, status_code=500))
    with pytest.raises(TranscriptionError):
        await _transcriber().transcribe(np.zeros(1600, dtype="<f4"), 16_000)


async def test_transcribe_malformed_response_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_stub(monkeypatch, _StubResponse({"unexpected": True}))
    with pytest.raises(TranscriptionError):
        await _transcriber().transcribe(np.zeros(1600, dtype="<f4"), 16_000)


async def test_transcribe_requires_16khz() -> None:
    with pytest.raises(TranscriptionError):
        await _transcriber().transcribe(np.zeros(1600, dtype="<f4"), 8_000)


async def test_transcribe_empty_audio_skips_request(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _install_stub(monkeypatch, _StubResponse({"text": "never"}))
    assert await _transcriber().transcribe(np.empty(0, dtype="<f4"), 16_000) == ""
    assert captured == {}
