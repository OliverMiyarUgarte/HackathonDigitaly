from __future__ import annotations

from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

TEST_TOKEN = "test-internal-token"
TEST_HEADERS = {"X-Internal-Token": TEST_TOKEN}


def build_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "ai_provider": "fake",
        "ai_internal_token": TEST_TOKEN,
        "session_ttl_seconds": 300,
        "max_buffer_bytes": 1_000_000,
        "partial_interval_seconds": 0.05,
    }
    values.update(overrides)
    return Settings.model_validate(values)


@pytest.fixture()
def client_factory() -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def factory(**overrides: object) -> TestClient:
        client = TestClient(create_app(build_settings(**overrides)))
        client.__enter__()
        clients.append(client)
        return client

    yield factory
    for client in reversed(clients):
        client.__exit__(None, None, None)
