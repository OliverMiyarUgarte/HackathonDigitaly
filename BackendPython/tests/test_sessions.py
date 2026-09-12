from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import TEST_HEADERS
from tests.helpers import create_session_payload


def test_create_session_requires_valid_token(client_factory) -> None:
    client: TestClient = client_factory()
    payload = create_session_payload()
    assert client.post("/sessions", json=payload).status_code == 401
    assert (
        client.post("/sessions", json=payload, headers={"X-Internal-Token": "wrong"}).status_code
        == 401
    )


def test_create_session_returns_contract(client_factory) -> None:
    client: TestClient = client_factory()
    response = client.post("/sessions", json=create_session_payload(), headers=TEST_HEADERS)
    assert response.status_code == 201
    body = response.json()
    assert body["sessionId"]
    assert body["expiresAt"].endswith("Z")
    assert set(body) == {"sessionId", "expiresAt"}


def test_create_session_rejects_invalid_body(client_factory) -> None:
    client: TestClient = client_factory()
    invalid_language = create_session_payload()
    invalid_language["language"] = "en-US"
    assert client.post("/sessions", json=invalid_language, headers=TEST_HEADERS).status_code == 422
    assert (
        client.post("/sessions", json={"language": "pt-BR"}, headers=TEST_HEADERS).status_code
        == 422
    )


def test_internal_token_is_fail_closed(client_factory) -> None:
    client: TestClient = client_factory(ai_internal_token="")
    assert (
        client.post("/sessions", json=create_session_payload(), headers=TEST_HEADERS).status_code
        == 401
    )
