# Changelog

All notable contract changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-12

### Added

- Initial shared contract package `@telemed/service-contracts`.
- Common enums and error/health types: `UserRole`, `AppointmentStatus`,
  `ConsultationStatus`, `FeedbackSeverity`, `AttachmentKind`, `HealthStatus`,
  `DependencyStatus`, `ErrorCode`, `ErrorResponseDto`, `HealthResponseDto`,
  `ReadyResponseDto`.
- Auth DTOs: `AuthTokensDto`, `RegisterRequestDto`, `LoginRequestDto`,
  `RefreshRequestDto`, `LogoutRequestDto`, `AuthResponseDto`.
- User DTOs: `UserDto`, `DoctorSummaryDto`, `CounterpartDto`, `UpdateUserRequestDto`.
- Appointment DTOs: `SlotDto`, `PreConsultAnswerInputDto`, `PreConsultAnswerDto`,
  `CreateAppointmentRequestDto`, `RequestCodeResponseDto`, `VerifyCodeRequestDto`,
  `AppointmentDto`, `CalendarEntryDto`, `DoctorAppointmentDto`,
  `CancelAppointmentRequestDto`, `PRE_CONSULT_QUESTION_KEYS`,
  `PreConsultQuestionKey`.
- Consultation DTOs: `IceServerDto`, `ParticipantDto`,
  `StartConsultationResponseDto`, `ConsultationDto`, `EndConsultationResponseDto`,
  `ConsultationHistoryItemDto`.
- Record DTOs: `CreateMedicalRecordRequestDto`, `MedicalRecordDto`,
  `MedicalRecordSummaryDto`, `PatientOverviewDto`.
- Attachment DTO: `AttachmentDto`.
- Socket.IO contract for namespace `/realtime`: `SocketData`,
  `ClientToServerEvents`, `ServerToClientEvents`, `InterServerEvents`.
- AI streaming contract: `CreateAiSessionRequestDto`, `AiSessionCreatedDto`,
  `AiHealthDto`, `AiClientFrame`, `AiServerFrame`.
- OpenAPI 3.1 document in `http/openapi.yaml`.
- Handwritten Pydantic v2 mirror in `python/contracts.py`.
