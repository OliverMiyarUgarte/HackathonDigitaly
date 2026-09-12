from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AiProvider = Literal["fake", "local", "openai"]

_ENV_TO_FIELD: Mapping[str, str] = {
    "AI_PROVIDER": "ai_provider",
    "OPENAI_API_KEY": "openai_api_key",
    "OPENAI_BASE_URL": "openai_base_url",
    "LLM_MODEL": "llm_model",
    "WHISPER_MODEL": "whisper_model",
    "WHISPER_DEVICE": "whisper_device",
    "WHISPER_COMPUTE_TYPE": "whisper_compute_type",
    "AI_INTERNAL_TOKEN": "ai_internal_token",
    "SESSION_TTL_SECONDS": "session_ttl_seconds",
    "MAX_BUFFER_BYTES": "max_buffer_bytes",
    "PARTIAL_INTERVAL_SECONDS": "partial_interval_seconds",
    "LLM_TIMEOUT_SECONDS": "llm_timeout_seconds",
    "LOG_LEVEL": "log_level",
}


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    ai_provider: AiProvider = "fake"
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = Field(default=30.0, gt=0)
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    ai_internal_token: str = ""
    session_ttl_seconds: int = Field(default=900, ge=1)
    max_buffer_bytes: int = Field(default=1_920_000, ge=1)
    partial_interval_seconds: float = Field(default=2.5, gt=0)
    target_sample_rate: int = 16_000
    target_channels: int = 1
    log_level: str = "INFO"

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        source = os.environ if env is None else env
        values: dict[str, object] = {}
        for env_name, field_name in _ENV_TO_FIELD.items():
            raw = source.get(env_name)
            if raw is None or raw == "":
                continue
            values[field_name] = raw.strip() if field_name == "ai_internal_token" else raw
        return cls.model_validate(values)
