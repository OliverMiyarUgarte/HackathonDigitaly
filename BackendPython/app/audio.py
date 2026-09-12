from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass, field

import numpy as np

SAMPLE_DTYPE = np.dtype("<i2")
FLOAT_DTYPE = np.dtype("<f4")
_INT16_SCALE = 32768.0


class AudioDecodeError(ValueError):
    pass


def pcm_bytes_to_float32(raw: bytes) -> np.ndarray:
    if len(raw) % 2 != 0:
        raise AudioDecodeError("pcm_s16le payload must have an even byte length")
    if not raw:
        return np.empty(0, dtype=FLOAT_DTYPE)
    integers = np.frombuffer(raw, dtype=SAMPLE_DTYPE)
    return (integers.astype(np.float32) / _INT16_SCALE).astype(FLOAT_DTYPE, copy=False)


def decode_base64_bytes(data: str) -> bytes:
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AudioDecodeError("data is not valid base64") from exc
    if len(raw) % 2 != 0:
        raise AudioDecodeError("pcm_s16le payload must have an even byte length")
    return raw


def decode_pcm_s16le(data: str) -> np.ndarray:
    return pcm_bytes_to_float32(decode_base64_bytes(data))


@dataclass
class PcmBuffer:
    max_bytes: int
    _data: bytearray = field(default_factory=bytearray)
    _truncated: bool = False

    @property
    def nbytes(self) -> int:
        return len(self._data)

    @property
    def truncated(self) -> bool:
        return self._truncated

    def append(self, raw: bytes) -> None:
        if not raw:
            return
        self._data.extend(raw)
        overflow = len(self._data) - self.max_bytes
        if overflow > 0:
            drop = overflow + (overflow % 2)
            del self._data[:drop]
            self._truncated = True

    def snapshot(self) -> np.ndarray:
        if not self._data:
            return np.empty(0, dtype=FLOAT_DTYPE)
        return pcm_bytes_to_float32(bytes(self._data))

    def clear(self) -> None:
        self._data.clear()
        self._truncated = False

    def acknowledge_truncation(self) -> bool:
        if not self._truncated:
            return False
        self._truncated = False
        return True

    def duration_seconds(self, sample_rate: int, channels: int) -> float:
        frame_bytes = 2 * channels
        if sample_rate <= 0 or frame_bytes <= 0:
            return 0.0
        return self.nbytes / (sample_rate * frame_bytes)
