# Changelog

All notable contract changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Whole-call summary: `ConsultationSummaryDto`, the `summary.ready` AI frame and the
  `consultation.summary` WebSocket event; `GET /api/consultations/{id}/summary`.
- Optional `from`/`to` date-time filters on `GET /api/appointments/calendar`.
- Optional `date` date-time filter on `GET /api/appointments/doctor`.
- Optional `from`/`to` date-time filters on `GET /api/consultations/mine`.
- Consultation history endpoint `GET /api/records/history` (`patientId`, `from`, `to`)
  returning `ConsultationHistoryItemDto[]`; replaces the previously documented
  `GET /api/records` summary listing.
- Runtime `USER_ROLES` and `APPOINTMENT_STATUSES` constants (with their derived
  `UserRole` and `AppointmentStatus` types) so API DTO validation references the shared
  contract instead of the database-generated enum.
- `GET /api/users/patients/{patientId}` returning `UserDto` for a doctor linked to the
  patient through a non-cancelled appointment.
- Optional `q` name filter on `GET /api/users/doctors`.

### Changed

- `GET /api/attachments/{id}` now returns the stored file `Content-Type` instead of JSON
  metadata; the OpenAPI 200 response accepts any binary content type (`*/*`) and
  `application/octet-stream` is only the fallback when the content type is unknown.
- Attachment `kind` is classified by the API; it is no longer an upload form field.
- `POST /api/auth/logout` is documented as public (`security: []`) because refresh
  tokens are opaque and revoked by value; the documented 401 response was removed.

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
