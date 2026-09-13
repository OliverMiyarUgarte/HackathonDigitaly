from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

FeedbackSeverity = Literal["info", "warning", "critical"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateAiSessionRequestDto(StrictModel):
    consultationId: str = Field(min_length=1)
    appointmentId: str = Field(min_length=1)
    language: Literal["pt-BR"]


class AiSessionCreatedDto(StrictModel):
    sessionId: str
    expiresAt: str


class AiHealthDto(StrictModel):
    status: Literal["ok"]
    provider: str
    timestamp: str


class AiAudioChunkFrame(StrictModel):
    type: Literal["audio.chunk"]
    seq: int
    data: str
    encoding: Literal["pcm_s16le"]
    sampleRate: int
    channels: Literal[1]


class AiAudioEndFrame(StrictModel):
    type: Literal["audio.end"]
    seq: int


class AiSessionCloseFrame(StrictModel):
    type: Literal["session.close"]
    reason: str | None = None


AiClientFrame = Annotated[
    AiAudioChunkFrame | AiAudioEndFrame | AiSessionCloseFrame,
    Field(discriminator="type"),
]


class AiTranscriptPartialFrame(StrictModel):
    type: Literal["transcript.partial"]
    text: str
    at: str


class AiTranscriptFinalFrame(StrictModel):
    type: Literal["transcript.final"]
    segmentId: str
    text: str
    at: str


class AiCopilotFeedbackFrame(StrictModel):
    type: Literal["copilot.feedback"]
    severity: FeedbackSeverity
    message: str
    at: str
    tags: list[str]


class AiSummaryReadyFrame(StrictModel):
    type: Literal["summary.ready"]
    doctorSummary: str
    patientSummary: str
    at: str


class AiErrorFrame(StrictModel):
    type: Literal["error"]
    code: str
    message: str
    at: str


AiServerFrame = Annotated[
    AiTranscriptPartialFrame
    | AiTranscriptFinalFrame
    | AiCopilotFeedbackFrame
    | AiSummaryReadyFrame
    | AiErrorFrame,
    Field(discriminator="type"),
]

CLIENT_FRAME_ADAPTER: TypeAdapter[AiClientFrame] = TypeAdapter(AiClientFrame)
