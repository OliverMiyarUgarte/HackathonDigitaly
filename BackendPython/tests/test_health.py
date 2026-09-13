from __future__ import annotations

import logging
from collections.abc import Callable
from typing import NoReturn

import pytest
from fastapi.testclient import TestClient

from app.providers import transcriber as provider_transcriber


def test_health_reports_provider(client_factory) -> None:
    client: TestClient = client_factory()
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["provider"] == "fake+rule"
    assert body["timestamp"].endswith("Z")


def test_local_without_engine_warns_and_uses_fake(
    client_factory: Callable[..., TestClient],
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unavailable(*args: object, **kwargs: object) -> NoReturn:
        raise provider_transcriber.TranscriptionError("no whisper backend available")

    monkeypatch.setattr(provider_transcriber, "_load_whisper", unavailable)
    with caplog.at_level(logging.WARNING, logger="digitaly.ai.providers"):
        client = client_factory(ai_provider="local")

    assert any("no Whisper backend" in record.getMessage() for record in caplog.records)

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["provider"] == "fake+rule"
