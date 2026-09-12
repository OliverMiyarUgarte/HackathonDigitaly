from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_reports_provider(client_factory) -> None:
    client: TestClient = client_factory()
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["provider"] == "fake+rule"
    assert body["timestamp"].endswith("Z")
