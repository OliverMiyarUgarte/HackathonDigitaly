"""Dev-only client: streams a WAV file through the AI copilot contract."""

from __future__ import annotations

import argparse
import base64
import json
import wave
from collections.abc import Iterator
from pathlib import Path

import httpx
import numpy as np
from websockets.sync.client import connect

TARGET_RATE = 16_000
CHUNK_SECONDS = 0.5
RECV_TIMEOUT_SECONDS = 10.0


def load_pcm(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        rate = handle.getframerate()
        frames = handle.readframes(handle.getnframes())
    if width != 2:
        raise SystemExit("Only 16-bit PCM WAV files are supported.")
    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if rate != TARGET_RATE and samples.size:
        duration = samples.size / rate
        target_count = int(duration * TARGET_RATE)
        source_axis = np.linspace(0.0, duration, num=samples.size, endpoint=False)
        target_axis = np.linspace(0.0, duration, num=target_count, endpoint=False)
        samples = np.interp(target_axis, source_axis, samples)
    return np.clip(samples, -32768, 32767).astype("<i2")


def iter_chunks(samples: np.ndarray) -> Iterator[bytes]:
    step = int(TARGET_RATE * CHUNK_SECONDS)
    for start in range(0, samples.size, step):
        yield samples[start : start + step].tobytes()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wav", type=Path)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--token", default="")
    parser.add_argument("--consultation-id", default="dev-consultation")
    parser.add_argument("--appointment-id", default="dev-appointment")
    args = parser.parse_args()

    headers = {"X-Internal-Token": args.token}
    samples = load_pcm(args.wav)

    response = httpx.post(
        f"{args.base_url}/sessions",
        headers=headers,
        json={
            "consultationId": args.consultation_id,
            "appointmentId": args.appointment_id,
            "language": "pt-BR",
        },
        timeout=10.0,
    )
    response.raise_for_status()
    session = response.json()
    session_id = session["sessionId"]
    print(f"session={session_id} expiresAt={session['expiresAt']}")

    ws_url = args.base_url.replace("http", "ws", 1).rstrip("/")
    uri = f"{ws_url}/sessions/{session_id}/audio"
    seq = 0
    with connect(uri, additional_headers=headers) as socket:
        for chunk in iter_chunks(samples):
            socket.send(
                json.dumps(
                    {
                        "type": "audio.chunk",
                        "seq": seq,
                        "data": base64.b64encode(chunk).decode("ascii"),
                        "encoding": "pcm_s16le",
                        "sampleRate": TARGET_RATE,
                        "channels": 1,
                    }
                )
            )
            seq += 1
        socket.send(json.dumps({"type": "audio.end", "seq": seq}))
        saw_final = False
        while True:
            try:
                raw = socket.recv(timeout=RECV_TIMEOUT_SECONDS)
            except TimeoutError:
                break
            if raw is None:
                break
            frame = json.loads(raw)
            print(json.dumps(frame, ensure_ascii=False))
            if frame.get("type") == "transcript.final":
                saw_final = True
            elif saw_final and frame.get("type") == "copilot.feedback":
                break


if __name__ == "__main__":
    main()
