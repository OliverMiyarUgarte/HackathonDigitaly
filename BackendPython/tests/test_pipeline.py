from __future__ import annotations

import time
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tests.conftest import TEST_HEADERS
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
