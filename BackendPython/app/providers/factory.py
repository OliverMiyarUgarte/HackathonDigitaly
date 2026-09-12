from __future__ import annotations

import logging
from dataclasses import dataclass

from app.config import Settings
from app.providers.copilot import Copilot, LlmCopilot, RuleCopilot
from app.providers.transcriber import (
    FakeTranscriber,
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
    try:
        return WhisperTranscriber(
            model_name=settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
    except TranscriptionError:
        logger.warning("Whisper unavailable; falling back to FakeTranscriber")
        return FakeTranscriber()
