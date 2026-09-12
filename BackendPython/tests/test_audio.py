from __future__ import annotations

import base64

import numpy as np
import pytest

from app.audio import (
    AudioDecodeError,
    PcmBuffer,
    decode_base64_bytes,
    decode_pcm_s16le,
    pcm_bytes_to_float32,
)


def test_decode_rejects_invalid_base64() -> None:
    with pytest.raises(AudioDecodeError):
        decode_base64_bytes("not base64!!")


def test_decode_rejects_odd_length() -> None:
    with pytest.raises(AudioDecodeError):
        decode_base64_bytes(base64.b64encode(b"\x00\x01\x02").decode("ascii"))


def test_decode_scales_to_float32() -> None:
    samples = np.array([0, 16384, -16384, -32768], dtype="<i2")
    decoded = decode_pcm_s16le(base64.b64encode(samples.tobytes()).decode("ascii"))
    assert decoded.dtype == np.dtype("<f4")
    assert decoded[0] == pytest.approx(0.0)
    assert decoded[1] == pytest.approx(0.5)
    assert decoded[2] == pytest.approx(-0.5)
    assert decoded[3] == pytest.approx(-1.0)


def test_pcm_buffer_caps_and_drops_oldest() -> None:
    buffer = PcmBuffer(max_bytes=8)
    buffer.append(bytes(range(8)))
    assert buffer.nbytes == 8
    assert not buffer.truncated
    buffer.append(b"\xff" * 8)
    assert buffer.nbytes <= 8
    assert buffer.truncated
    assert buffer.acknowledge_truncation()
    assert not buffer.acknowledge_truncation()


def test_pcm_buffer_clear_resets_state() -> None:
    buffer = PcmBuffer(max_bytes=4)
    buffer.append(b"\x00" * 8)
    assert buffer.truncated
    buffer.clear()
    assert buffer.nbytes == 0
    assert not buffer.truncated


def test_duration_seconds() -> None:
    buffer = PcmBuffer(max_bytes=100_000)
    buffer.append(b"\x00" * 32_000)
    assert buffer.duration_seconds(16_000, 1) == pytest.approx(1.0)


def test_empty_pcm_decodes_to_empty_array() -> None:
    assert pcm_bytes_to_float32(b"").size == 0
