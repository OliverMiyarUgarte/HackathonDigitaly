from __future__ import annotations

import logging
from dataclasses import dataclass

from app.config import Settings
from app.providers.copilot import Copilot, LlmCopilot, RuleCopilot
from app.providers.transcriber import (
    FakeTranscriber,
    OpenAITranscriber,
    Transcriber,
    TranscriptionError,
    WhisperTranscriber,
)

logger = logging.getLogger("digitaly.ai.providers")


@dataclass(frozen=True)
class Providers:
    transcriber: Transcriber
    copilot: Copilot

    @property
    def name(self) -> str:
        return f"{self.transcriber.name}+{self.copilot.name}"


def build_providers(settings: Settings) -> Providers:
    rule_copilot = RuleCopilot()
    if settings.ai_provider == "fake":
        return Providers(transcriber=FakeTranscriber(), copilot=rule_copilot)

    transcriber = _build_transcriber(settings)
    if settings.ai_provider == "openai" and settings.openai_api_key:
        copilot: Copilot = LlmCopilot(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.llm_model,
            timeout_seconds=settings.llm_timeout_seconds,
            fallback=rule_copilot,
        )
    else:
        copilot = rule_copilot
    return Providers(transcriber=transcriber, copilot=copilot)


def _build_transcriber(settings: Settings) -> Transcriber:
    if settings.ai_provider == "openai":
        return _build_openai_transcriber(settings)
    return _build_whisper_transcriber(settings)


def _build_openai_transcriber(settings: Settings) -> Transcriber:
    if not settings.openai_api_key:
        logger.warning(
            "AI_PROVIDER=openai but OPENAI_API_KEY is not set; "
            "using FakeTranscriber (health reports fake+rule)."
        )
        return FakeTranscriber()
    return OpenAITranscriber(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        model=settings.stt_model,
        timeout_seconds=settings.llm_timeout_seconds,
    )


def _build_whisper_transcriber(settings: Settings) -> Transcriber:
    try:
        return WhisperTranscriber(
            model_name=settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
    except TranscriptionError:
        logger.warning(
            "AI_PROVIDER=local but no Whisper backend is installed; "
            "using FakeTranscriber (health reports fake+rule). "
            "Install faster-whisper with 'pip install -r requirements-whisper.txt'."
        )
        return FakeTranscriber()
