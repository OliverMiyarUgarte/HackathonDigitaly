from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from types import ModuleType, UnionType
from typing import Literal, Union, get_args, get_origin

import pytest
from pydantic import BaseModel

from app import models

MODEL_NAMES = (
    "CreateAiSessionRequestDto",
    "AiSessionCreatedDto",
    "AiHealthDto",
    "AiAudioChunkFrame",
    "AiAudioEndFrame",
    "AiSessionCloseFrame",
    "AiTranscriptPartialFrame",
    "AiTranscriptFinalFrame",
    "AiCopilotFeedbackFrame",
    "AiErrorFrame",
)


def _load_shared_contracts() -> ModuleType | None:
    override = os.getenv("SERVICE_CONTRACTS_PYTHON")
    base = (
        Path(override)
        if override
        else Path(__file__).resolve().parents[2] / "service-contracts" / "python"
    )
    target = base / "contracts.py"
    if not target.exists():
        return None
    spec = importlib.util.spec_from_file_location("shared_contracts", target)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


shared = _load_shared_contracts()

pytestmark = pytest.mark.skipif(shared is None, reason="service-contracts package not available")


def test_field_names_match_shared_contract() -> None:
    assert shared is not None
    for name in MODEL_NAMES:
        local = getattr(models, name)
        remote = getattr(shared, name)
        assert set(local.model_fields) == set(remote.model_fields), name


def test_required_fields_match_shared_contract() -> None:
    assert shared is not None
    for name in MODEL_NAMES:
        local = getattr(models, name)
        remote = getattr(shared, name)
        local_required = {field for field, info in local.model_fields.items() if info.is_required()}
        remote_required = {
            field for field, info in remote.model_fields.items() if info.is_required()
        }
        assert local_required == remote_required, name


def test_feedback_severity_values_match() -> None:
    assert shared is not None
    local = get_args(models.AiCopilotFeedbackFrame.model_fields["severity"].annotation)
    remote = get_args(shared.AiCopilotFeedbackFrame.model_fields["severity"].annotation)
    assert set(local) == set(remote)


CRITICAL_FIELD_ANNOTATIONS = {
    "AiAudioChunkFrame": ("type", "encoding", "sampleRate", "channels"),
    "AiCopilotFeedbackFrame": ("type", "severity"),
    "AiTranscriptPartialFrame": ("type",),
    "AiTranscriptFinalFrame": ("type",),
    "AiAudioEndFrame": ("type",),
    "AiSessionCloseFrame": ("type",),
    "AiErrorFrame": ("type",),
}


def _normalize_annotation(annotation: object) -> object:
    origin = get_origin(annotation)
    if origin is None:
        return type(None) if annotation is None else annotation
    if origin is Union or origin is UnionType:
        normalized_origin: object = Union
    else:
        normalized_origin = origin
    return (normalized_origin, tuple(_normalize_annotation(arg) for arg in get_args(annotation)))


def _field_annotation(model: type[BaseModel], field: str) -> object:
    return model.model_fields[field].annotation


def test_field_annotations_match_shared_contract() -> None:
    assert shared is not None
    for name in MODEL_NAMES:
        local = getattr(models, name)
        remote = getattr(shared, name)
        for field in local.model_fields:
            assert _normalize_annotation(_field_annotation(local, field)) == _normalize_annotation(
                _field_annotation(remote, field)
            ), f"{name}.{field}"


def test_critical_field_annotations_match_shared_contract() -> None:
    assert shared is not None
    for name, fields in CRITICAL_FIELD_ANNOTATIONS.items():
        local = getattr(models, name)
        remote = getattr(shared, name)
        for field in fields:
            assert _normalize_annotation(_field_annotation(local, field)) == _normalize_annotation(
                _field_annotation(remote, field)
            ), f"{name}.{field}"


def test_audio_chunk_channels_is_mono_literal() -> None:
    assert shared is not None
    local = models.AiAudioChunkFrame.model_fields["channels"].annotation
    remote = shared.AiAudioChunkFrame.model_fields["channels"].annotation
    assert get_origin(local) is Literal
    assert get_origin(remote) is Literal
    assert get_args(local) == (1,)
    assert get_args(remote) == (1,)


def _frame_type_values(annotated: object) -> set[str]:
    union = get_args(annotated)[0]
    values: set[str] = set()
    for variant in get_args(union):
        values.add(get_args(variant.model_fields["type"].annotation)[0])
    return values


def test_client_frame_variants_match() -> None:
    assert shared is not None
    assert _frame_type_values(models.AiClientFrame) == _frame_type_values(shared.AiClientFrame)


def test_server_frame_variants_match() -> None:
    assert shared is not None
    assert _frame_type_values(models.AiServerFrame) == _frame_type_values(shared.AiServerFrame)
