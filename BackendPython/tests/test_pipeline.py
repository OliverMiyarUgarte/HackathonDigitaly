from __future__ import annotations

import json
import time
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.pipeline import run_audio_session
from app.providers.copilot import Feedback
from app.providers.transcriber import FakeTranscriber
from app.session import create_session as create_ai_session
from tests.conftest import TEST_HEADERS, build_settings
from tests.helpers import audio_chunk, create_session_payload, wait_until


def create_session(client: TestClient) -> str:
    response = client.post("/sessions", json=create_session_payload(), headers=TEST_HEADERS)
    assert response.status_code == 201
    return str(response.json()["sessionId"])


def collect_until_terminal(
    ws: Any, feedback_count: int = 1, limit: int = 40
) -> list[dict[str, Any]]:
    frames: list[dict[str, Any]] = []
    for _ in range(limit):
        frame = ws.receive_json()
        frames.append(frame)
        types = {item["type"] for item in frames}
        feedbacks = sum(1 for item in frames if item["type"] == "copilot.feedback")
        if "transcript.final" in types and feedbacks >= feedback_count:
            break
    return frames


def collect_finals(ws: Any, count: int, limit: int = 80) -> list[dict[str, Any]]:
    frames: list[dict[str, Any]] = []
    seen = 0
    for _ in range(limit):
        frame = ws.receive_json()
        frames.append(frame)
        if frame["type"] == "transcript.final":
            seen += 1
            if seen >= count:
                break
    return frames


def drain_frames(ws: Any) -> list[dict[str, Any]]:
    frames: list[dict[str, Any]] = []
    while True:
        try:
            frames.append(ws.receive_json())
        except WebSocketDisconnect:
            return frames


def test_full_fake_run_produces_all_frames(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(0))
        ws.send_json(audio_chunk(1))
        time.sleep(0.1)
        ws.send_json({"type": "audio.end", "seq": 2})
        frames = collect_until_terminal(ws, feedback_count=2)

    types = {frame["type"] for frame in frames}
    assert "transcript.partial" in types
    assert "transcript.final" in types
    assert "copilot.feedback" in types

    partial = next(frame for frame in frames if frame["type"] == "transcript.partial")
    assert partial["text"]

    final = next(frame for frame in frames if frame["type"] == "transcript.final")
    assert final["segmentId"]
    assert "dor no peito" in final["text"]

    feedback = [frame for frame in frames if frame["type"] == "copilot.feedback"]
    tags = {tag for frame in feedback for tag in frame["tags"]}
    assert "red_flag" in tags
    assert "chest_pain" in tags
    assert "dyspnea" in tags
    assert any(frame["severity"] == "critical" for frame in feedback)


def test_audio_end_resumes_without_new_session(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(0))
        ws.send_json(audio_chunk(1))
        ws.send_json({"type": "audio.end", "seq": 2})
        first = collect_finals(ws, 1)
        assert client.app.state.sessions.get(session_id) is not None

        ws.send_json(audio_chunk(3))
        ws.send_json({"type": "audio.end", "seq": 4})
        second = collect_finals(ws, 1)

    frames = first + second
    finals = [frame for frame in frames if frame["type"] == "transcript.final"]
    assert len(finals) == 2
    assert all(frame["text"] for frame in finals)
    assert finals[0]["segmentId"] != finals[1]["segmentId"]
    assert wait_until(lambda: client.app.state.sessions.get(session_id) is None)


def test_late_chunks_are_ignored(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(1))
        ws.send_json(audio_chunk(1))
        ws.send_json({"type": "audio.end", "seq": 1})
        collect_until_terminal(ws)
    assert wait_until(lambda: client.app.state.sessions.get(session_id) is None)


def test_oversized_buffer_is_capped(client_factory) -> None:
    client: TestClient = client_factory(max_buffer_bytes=8000)
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(0))
        ws.send_json(audio_chunk(1))
        time.sleep(0.1)
        session = client.app.state.sessions.get(session_id)
        assert session is not None
        assert session.buffer.nbytes <= 8000
        ws.send_json({"type": "audio.end", "seq": 2})
        frames = collect_until_terminal(ws)
    codes = {frame["code"] for frame in frames if frame["type"] == "error"}
    assert "BUFFER_TRUNCATED" in codes
    assert any(frame["type"] == "transcript.final" for frame in frames)


def test_invalid_frame_returns_error_and_keeps_socket(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json({"type": "unknown.event"})
        error = ws.receive_json()
        assert error["type"] == "error"
        assert error["code"] == "VALIDATION_FAILED"
        ws.send_json(audio_chunk(0))
        ws.send_json({"type": "audio.end", "seq": 1})
        frames = collect_until_terminal(ws)
    assert any(frame["type"] == "transcript.final" for frame in frames)


def test_unsupported_sample_rate_returns_error(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(0, sample_rate=8000))
        error = ws.receive_json()
        assert error["type"] == "error"
        assert error["code"] == "UNSUPPORTED_AUDIO"


def test_non_mono_channels_fail_contract_and_keep_socket(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(0, channels=2))
        error = ws.receive_json()
        assert error["type"] == "error"
        assert error["code"] == "VALIDATION_FAILED"
        ws.send_json(audio_chunk(1))
        ws.send_json({"type": "audio.end", "seq": 2})
        frames = collect_until_terminal(ws)
    assert any(frame["type"] == "transcript.final" for frame in frames)


def test_websocket_rejects_bad_token(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/sessions/{session_id}/audio") as ws:
            ws.receive_json()
    assert excinfo.value.code == 4401


def test_websocket_rejects_unknown_session(client_factory) -> None:
    client: TestClient = client_factory()
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/sessions/missing/audio", headers=TEST_HEADERS) as ws:
            ws.receive_json()
    assert excinfo.value.code == 4404


def test_session_close_tears_down(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
            ws.send_json({"type": "session.close", "reason": "doctor ended"})
            ws.receive_json()
    assert excinfo.value.code == 1000
    assert client.app.state.sessions.get(session_id) is None


def test_audio_end_emits_single_summary(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(0))
        ws.send_json(audio_chunk(1))
        ws.send_json({"type": "audio.end", "seq": 2})
        ws.send_json({"type": "session.close", "reason": "test"})
        frames = drain_frames(ws)

    finals = [frame for frame in frames if frame["type"] == "transcript.final"]
    summaries = [frame for frame in frames if frame["type"] == "summary.ready"]
    assert len(finals) == 1
    assert len(summaries) == 1
    summary = summaries[0]
    assert summary["doctorSummary"].strip()
    assert summary["patientSummary"].strip()
    assert summary["at"].endswith("Z")


def test_second_audio_end_does_not_reemit_summary(client_factory) -> None:
    client: TestClient = client_factory()
    session_id = create_session(client)
    with client.websocket_connect(f"/sessions/{session_id}/audio", headers=TEST_HEADERS) as ws:
        ws.send_json(audio_chunk(0))
        ws.send_json({"type": "audio.end", "seq": 1})
        ws.send_json(audio_chunk(2))
        ws.send_json({"type": "audio.end", "seq": 3})
        ws.send_json({"type": "session.close", "reason": "test"})
        frames = drain_frames(ws)

    finals = [frame for frame in frames if frame["type"] == "transcript.final"]
    summaries = [frame for frame in frames if frame["type"] == "summary.ready"]
    assert len(finals) == 2
    assert len(summaries) == 1


class _FailingReportCopilot:
    name = "failing"

    async def feedback(self, transcript: str) -> list[Feedback]:
        return []

    async def doctor_report(self, transcript: str) -> str:
        raise RuntimeError("doctor report failed")

    async def patient_report(self, transcript: str) -> str:
        raise RuntimeError("patient report failed")


class _RecordingWebSocket:
    def __init__(self, frames: list[str]) -> None:
        self._frames = frames
        self.sent: list[dict[str, Any]] = []

    async def receive_text(self) -> str:
        if not self._frames:
            raise WebSocketDisconnect(code=1000)
        return self._frames.pop(0)

    async def send_text(self, data: str) -> None:
        self.sent.append(json.loads(data))


async def test_summary_failure_emits_error_and_keeps_session() -> None:
    settings = build_settings()
    session = create_ai_session("consultation-1", "appointment-1", "pt-BR", settings)
    frames = [
        json.dumps(audio_chunk(0)),
        json.dumps({"type": "audio.end", "seq": 1}),
    ]
    ws = _RecordingWebSocket(frames)
    await run_audio_session(session, ws, settings, FakeTranscriber(), _FailingReportCopilot())
    types = [frame["type"] for frame in ws.sent]
    errors = [frame for frame in ws.sent if frame["type"] == "error"]
    assert "transcript.final" in types
    assert any(frame["code"] == "SUMMARY_FAILED" for frame in errors)
    assert session.closed is False
