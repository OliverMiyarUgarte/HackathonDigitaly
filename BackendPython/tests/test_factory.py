from __future__ import annotations

import logging

import pytest

from app.config import Settings
from app.providers.copilot import LlmCopilot, RuleCopilot
from app.providers.factory import build_providers
from app.providers.transcriber import FakeTranscriber, OpenAITranscriber


def test_settings_from_env_reads_stt_model() -> None:
    settings = Settings.from_env({"STT_MODEL": "gpt-4o-transcribe"})
    assert settings.stt_model == "gpt-4o-transcribe"


def test_factory_openai_with_key_selects_openai_transcriber() -> None:
    settings = Settings.model_validate(
        {"ai_provider": "openai", "openai_api_key": "sk-test", "stt_model": "gpt-4o-transcribe"}
    )
    providers = build_providers(settings)
    assert isinstance(providers.transcriber, OpenAITranscriber)
    assert providers.transcriber.name == "openai-stt:gpt-4o-transcribe"
    assert isinstance(providers.copilot, LlmCopilot)
    assert providers.name == "openai-stt:gpt-4o-transcribe+openai:gpt-4o-mini"


def test_factory_openai_without_key_falls_back_to_fake(
    caplog: pytest.LogCaptureFixture,
) -> None:
    settings = Settings.model_validate({"ai_provider": "openai"})
    with caplog.at_level(logging.WARNING, logger="digitaly.ai.providers"):
        providers = build_providers(settings)
    assert isinstance(providers.transcriber, FakeTranscriber)
    assert isinstance(providers.copilot, RuleCopilot)
    assert providers.name == "fake+rule"
    assert any("OPENAI_API_KEY" in record.getMessage() for record in caplog.records)
