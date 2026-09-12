from typing import Annotated, Dict, List, Literal, Optional, Union, get_args

from pydantic import BaseModel, ConfigDict, Field

UserRole = Literal["doctor", "patient"]
USER_ROLES = get_args(UserRole)

AppointmentStatus = Literal[
    "pending_code",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
]
APPOINTMENT_STATUSES = get_args(AppointmentStatus)

ConsultationStatus = Literal["active", "ended"]

FeedbackSeverity = Literal["info", "warning", "critical"]

AttachmentKind = Literal["document", "image", "other"]

HealthStatus = Literal["ok", "degraded"]

DependencyStatus = Literal["up", "down", "unknown"]

ErrorCode = Literal[
    "VALIDATION_FAILED",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "EMAIL_TAKEN",
    "INVALID_CREDENTIALS",
    "INVALID_REFRESH_TOKEN",
    "INVALID_OR_EXPIRED_CODE",
    "TOO_MANY_ATTEMPTS",
    "RATE_LIMITED",
    "SLOT_TAKEN",
    "APPOINTMENT_NOT_CONFIRMED",
    "APPOINTMENT_TERMINAL",
    "CONSULTATION_EXISTS",
    "CONSULTATION_NOT_ACTIVE",
    "RECORD_EXISTS",
    "FILE_TOO_LARGE",
    "UNSUPPORTED_MEDIA_TYPE",
    "AI_UNAVAILABLE",
    "INTERNAL_ERROR",
]

PRE_CONSULT_QUESTION_KEYS = (
    "chief_complaint",
    "symptom_duration",
    "current_medications",
    "allergies",
    "medical_history",
)

PreConsultQuestionKey = Literal[
    "chief_complaint",
    "symptom_duration",
    "current_medications",
    "allergies",
    "medical_history",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorResponseDto(StrictModel):
    statusCode: int
    error: str
    message: str
    details: Optional[List[str]]
    timestamp: str
    path: str
    correlationId: str


class HealthResponseDto(StrictModel):
    status: Literal["ok"]
    uptimeSeconds: float
    timestamp: str
    version: str


class ReadyChecksDto(StrictModel):
    database: DependencyStatus
    ai: DependencyStatus


class ReadyResponseDto(StrictModel):
    status: HealthStatus
    checks: ReadyChecksDto
    timestamp: str


class UserDto(StrictModel):
    id: str
    name: str
    email: str
    role: UserRole
    specialty: Optional[str]
    crm: Optional[str]
    createdAt: str


class DoctorSummaryDto(StrictModel):
    id: str
    name: str
    specialty: Optional[str]
    crm: Optional[str]


class CounterpartDto(StrictModel):
    id: str
    name: str
    role: UserRole
    specialty: Optional[str]


class UpdateUserRequestDto(StrictModel):
    name: Optional[str] = None
    specialty: Optional[str] = None


class AuthTokensDto(StrictModel):
    accessToken: str
    refreshToken: str
    tokenType: Literal["Bearer"]
    expiresIn: int


class RegisterRequestDto(StrictModel):
    name: str
    email: str
    password: str
    role: UserRole
    specialty: Optional[str] = None
    crm: Optional[str] = None


class LoginRequestDto(StrictModel):
    email: str
    password: str


class RefreshRequestDto(StrictModel):
    refreshToken: str


class LogoutRequestDto(StrictModel):
    refreshToken: Optional[str] = None


class AuthResponseDto(StrictModel):
    user: UserDto
    tokens: AuthTokensDto


class SlotDto(StrictModel):
    startsAt: str
    endsAt: str
    doctorId: str


class PreConsultAnswerInputDto(StrictModel):
    questionKey: str
    answer: str


class PreConsultAnswerDto(StrictModel):
    id: str
    appointmentId: str
    questionKey: str
    answer: str
    createdAt: str


class CreateAppointmentRequestDto(StrictModel):
    doctorId: str
    scheduledAt: str
    preConsult: Optional[List[PreConsultAnswerInputDto]] = None


class RequestCodeResponseDto(StrictModel):
    appointmentId: str
    expiresAt: str
    attemptsRemaining: int


class VerifyCodeRequestDto(StrictModel):
    code: str


class AppointmentDto(StrictModel):
    id: str
    patientId: str
    doctorId: str
    scheduledAt: str
    status: AppointmentStatus
    createdAt: str
    updatedAt: str


class CalendarEntryDto(StrictModel):
    appointmentId: str
    scheduledAt: str
    status: AppointmentStatus
    counterpart: CounterpartDto
    consultationId: Optional[str]
    isCurrent: bool


class DoctorAppointmentDto(StrictModel):
    appointmentId: str
    scheduledAt: str
    status: AppointmentStatus
    patient: CounterpartDto
    consultationId: Optional[str]
    hasPreConsult: bool


class CancelAppointmentRequestDto(StrictModel):
    reason: Optional[str] = None


class IceServerDto(StrictModel):
    urls: List[str]
    username: Optional[str] = None
    credential: Optional[str] = None


class ParticipantDto(StrictModel):
    userId: str
    role: UserRole
    joinedAt: Optional[str]


class StartConsultationResponseDto(StrictModel):
    consultationId: str
    appointmentId: str
    status: ConsultationStatus
    startedAt: str
    roomId: str
    iceServers: List[IceServerDto]
    participants: List[ParticipantDto]


class ConsultationDto(StrictModel):
    id: str
    appointmentId: str
    status: ConsultationStatus
    startedAt: str
    endedAt: Optional[str]


class EndConsultationResponseDto(StrictModel):
    consultationId: str
    appointmentId: str
    status: ConsultationStatus
    startedAt: str
    endedAt: str


class ConsultationHistoryItemDto(StrictModel):
    consultationId: str
    appointmentId: str
    startedAt: str
    endedAt: Optional[str]
    doctor: CounterpartDto
    diagnosis: Optional[str]


class CreateMedicalRecordRequestDto(StrictModel):
    consultationId: str
    patientId: str
    notes: str
    diagnosis: Optional[str] = None
    prescriptions: Optional[List[str]] = None


class MedicalRecordDto(StrictModel):
    id: str
    patientId: str
    consultationId: str
    createdBy: str
    notes: str
    diagnosis: Optional[str]
    prescriptions: List[str]
    createdAt: str


class MedicalRecordSummaryDto(StrictModel):
    id: str
    consultationId: str
    createdAt: str
    diagnosis: Optional[str]


class PatientOverviewDto(StrictModel):
    patient: UserDto
    upcomingAppointment: Optional[AppointmentDto]
    history: List[MedicalRecordSummaryDto]
    preConsult: List[PreConsultAnswerDto]


class AttachmentDto(StrictModel):
    id: str
    appointmentId: str
    consultationId: Optional[str]
    uploaderId: str
    fileName: str
    contentType: str
    sizeBytes: int
    kind: AttachmentKind
    downloadUrl: str
    createdAt: str


class CreateAiSessionRequestDto(StrictModel):
    consultationId: str
    appointmentId: str
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
    reason: Optional[str] = None


AiClientFrame = Annotated[
    Union[AiAudioChunkFrame, AiAudioEndFrame, AiSessionCloseFrame],
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
    tags: List[str]


class AiErrorFrame(StrictModel):
    type: Literal["error"]
    code: str
    message: str
    at: str


AiServerFrame = Annotated[
    Union[
        AiTranscriptPartialFrame,
        AiTranscriptFinalFrame,
        AiCopilotFeedbackFrame,
        AiErrorFrame,
    ],
    Field(discriminator="type"),
]

WebSocketEventPayloads: Dict[str, str] = {
    "room.joined": "appointmentId, participants, iceServers",
    "room.error": "code, message",
    "consultation.started": "appointmentId, consultationId, doctorId, startedAt",
    "consultation.ended": "appointmentId, consultationId, endedAt",
    "participant.joined": "appointmentId, userId, role, joinedAt",
    "participant.left": "appointmentId, userId, role, leftAt",
    "webrtc.offer": "appointmentId, fromUserId, sdp",
    "webrtc.answer": "appointmentId, fromUserId, sdp",
    "webrtc.ice": "appointmentId, fromUserId, candidate, sdpMid, sdpMLineIndex",
    "media.state": "appointmentId, userId, mic, camera",
    "transcript.partial": "consultationId, text, at",
    "transcript.final": "consultationId, segmentId, text, at",
    "copilot.feedback": "consultationId, severity, message, at, tags",
    "ai.status": "consultationId, status",
    "error": "code, message",
}
