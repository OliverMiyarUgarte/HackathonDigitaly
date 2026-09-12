from __future__ import annotations

import base64
import time
from collections.abc import Callable

import numpy as np

TARGET_SAMPLE_RATE = 16_000


def wait_until(condition: Callable[[], bool], timeout: float = 2.0, interval: float = 0.01) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(interval)
    return condition()


def pcm_base64(seconds: float, value: int = 0) -> str:
    count = max(1, int(TARGET_SAMPLE_RATE * seconds))
    samples = np.full(count, value, dtype="<i2")
    return base64.b64encode(samples.tobytes()).decode("ascii")


def audio_chunk(
    seq: int,
    seconds: float = 0.25,
    sample_rate: int = TARGET_SAMPLE_RATE,
    channels: int = 1,
) -> dict[str, object]:
    return {
        "type": "audio.chunk",
        "seq": seq,
        "data": pcm_base64(seconds),
        "encoding": "pcm_s16le",
        "sampleRate": sample_rate,
        "channels": channels,
    }


def create_session_payload(
    consultation_id: str = "consultation-1",
    appointment_id: str = "appointment-1",
) -> dict[str, str]:
    return {
        "consultationId": consultation_id,
        "appointmentId": appointment_id,
        "language": "pt-BR",
    }
