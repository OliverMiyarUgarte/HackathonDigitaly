import { z } from "zod";
import {
  APPOINTMENT_STATUSES,
  PRE_CONSULT_QUESTION_KEYS,
  USER_ROLES,
  type AttachmentKind as ContractAttachmentKind,
  type ConsultationStatus as ContractConsultationStatus,
  type DependencyStatus as ContractDependencyStatus,
  type ErrorCode as ContractErrorCode,
  type FeedbackSeverity as ContractFeedbackSeverity,
  type HealthStatus as ContractHealthStatus,
} from "@telemed/service-contracts";

export { APPOINTMENT_STATUSES, PRE_CONSULT_QUESTION_KEYS, USER_ROLES };
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const CONSULTATION_STATUSES = ["active", "ended"] as const satisfies readonly ContractConsultationStatus[];
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];
export const consultationStatusSchema = z.enum(CONSULTATION_STATUSES);

export const FEEDBACK_SEVERITIES = ["info", "warning", "critical"] as const satisfies readonly ContractFeedbackSeverity[];
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];
export const feedbackSeveritySchema = z.enum(FEEDBACK_SEVERITIES);

export const ATTACHMENT_KINDS = ["document", "image", "other"] as const satisfies readonly ContractAttachmentKind[];
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];
export const attachmentKindSchema = z.enum(ATTACHMENT_KINDS);

export const HEALTH_STATUSES = ["ok", "degraded"] as const satisfies readonly ContractHealthStatus[];
export const healthStatusSchema = z.enum(HEALTH_STATUSES);

export const DEPENDENCY_STATUSES = ["up", "down", "unknown"] as const satisfies readonly ContractDependencyStatus[];
export const dependencyStatusSchema = z.enum(DEPENDENCY_STATUSES);

export const ERROR_CODES = [
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
] as const satisfies readonly ContractErrorCode[];
export type ErrorCode = (typeof ERROR_CODES)[number];
export const errorCodeSchema = z.enum(ERROR_CODES);

export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  details: z.array(z.string()).nullable(),
  timestamp: z.string(),
  path: z.string(),
  correlationId: z.string(),
});
export type ErrorResponseDto = z.infer<typeof errorResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
  version: z.string(),
});
export type HealthResponseDto = z.infer<typeof healthResponseSchema>;

export const readyResponseSchema = z.object({
  status: healthStatusSchema,
  checks: z.object({
    database: dependencyStatusSchema,
    ai: dependencyStatusSchema,
  }),
  timestamp: z.string(),
});
export type ReadyResponseDto = z.infer<typeof readyResponseSchema>;

export const userDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: userRoleSchema,
  specialty: z.string().nullable(),
  crm: z.string().nullable(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const doctorSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  specialty: z.string().nullable(),
  crm: z.string().nullable(),
});
export type DoctorSummaryDto = z.infer<typeof doctorSummaryDtoSchema>;

export const counterpartDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: userRoleSchema,
  specialty: z.string().nullable(),
});
export type CounterpartDto = z.infer<typeof counterpartDtoSchema>;

export const updateUserRequestSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  specialty: z.string().min(2).max(120).optional(),
});
export type UpdateUserRequestDto = z.infer<typeof updateUserRequestSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int(),
});
export type AuthTokensDto = z.infer<typeof authTokensSchema>;

export const registerRequestSchema = z.object({
  name: z.string().min(2, "Informe o nome completo").max(120),
  email: z.email("Informe um e-mail válido"),
  password: z.string().min(8, "Use ao menos 8 caracteres").max(72),
  role: userRoleSchema,
  specialty: z.string().min(2).max(120).optional(),
  crm: z.string().min(2).max(40).optional(),
});
export type RegisterRequestDto = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha").max(72),
});
export type LoginRequestDto = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequestDto = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type LogoutRequestDto = z.infer<typeof logoutRequestSchema>;

export const authResponseSchema = z.object({
  user: userDtoSchema,
  tokens: authTokensSchema,
});
export type AuthResponseDto = z.infer<typeof authResponseSchema>;

export const preConsultQuestionKeySchema = z.enum(PRE_CONSULT_QUESTION_KEYS);
export type PreConsultQuestionKey = z.infer<typeof preConsultQuestionKeySchema>;

export const preConsultAnswerInputSchema = z.object({
  questionKey: preConsultQuestionKeySchema,
  answer: z.string(),
});
export type PreConsultAnswerInputDto = z.infer<typeof preConsultAnswerInputSchema>;

export const preConsultAnswerSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
  questionKey: z.string(),
  answer: z.string(),
  createdAt: z.string(),
});
export type PreConsultAnswerDto = z.infer<typeof preConsultAnswerSchema>;

export const slotSchema = z.object({
  startsAt: z.string(),
  endsAt: z.string(),
  doctorId: z.string(),
});
export type SlotDto = z.infer<typeof slotSchema>;

export const createAppointmentRequestSchema = z.object({
  doctorId: z.string(),
  scheduledAt: z.string(),
  preConsult: z.array(preConsultAnswerInputSchema).optional(),
});
export type CreateAppointmentRequestDto = z.infer<typeof createAppointmentRequestSchema>;

export const requestCodeResponseSchema = z.object({
  appointmentId: z.string(),
  expiresAt: z.string(),
  attemptsRemaining: z.number().int(),
});
export type RequestCodeResponseDto = z.infer<typeof requestCodeResponseSchema>;

export const verifyCodeRequestSchema = z.object({
  code: z.string(),
});
export type VerifyCodeRequestDto = z.infer<typeof verifyCodeRequestSchema>;

export const appointmentSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  doctorId: z.string(),
  scheduledAt: z.string(),
  status: appointmentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AppointmentDto = z.infer<typeof appointmentSchema>;

export const calendarEntrySchema = z.object({
  appointmentId: z.string(),
  scheduledAt: z.string(),
  status: appointmentStatusSchema,
  counterpart: counterpartDtoSchema,
  consultationId: z.string().nullable(),
  isCurrent: z.boolean(),
});
export type CalendarEntryDto = z.infer<typeof calendarEntrySchema>;

export const doctorAppointmentSchema = z.object({
  appointmentId: z.string(),
  scheduledAt: z.string(),
  status: appointmentStatusSchema,
  patient: counterpartDtoSchema,
  consultationId: z.string().nullable(),
  hasPreConsult: z.boolean(),
});
export type DoctorAppointmentDto = z.infer<typeof doctorAppointmentSchema>;

export const cancelAppointmentRequestSchema = z.object({
  reason: z.string().optional(),
});
export type CancelAppointmentRequestDto = z.infer<typeof cancelAppointmentRequestSchema>;

export const iceServerSchema = z.object({
  urls: z.array(z.string()),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServerDto = z.infer<typeof iceServerSchema>;

export const participantSchema = z.object({
  userId: z.string(),
  role: userRoleSchema,
  joinedAt: z.string().nullable(),
});
export type ParticipantDto = z.infer<typeof participantSchema>;

export const startConsultationResponseSchema = z.object({
  consultationId: z.string(),
  appointmentId: z.string(),
  status: consultationStatusSchema,
  startedAt: z.string(),
  roomId: z.string(),
  iceServers: z.array(iceServerSchema),
  participants: z.array(participantSchema),
});
export type StartConsultationResponseDto = z.infer<typeof startConsultationResponseSchema>;

export const consultationSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
  status: consultationStatusSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type ConsultationDto = z.infer<typeof consultationSchema>;

export const endConsultationResponseSchema = z.object({
  consultationId: z.string(),
  appointmentId: z.string(),
  status: consultationStatusSchema,
  startedAt: z.string(),
  endedAt: z.string(),
});
export type EndConsultationResponseDto = z.infer<typeof endConsultationResponseSchema>;

export const consultationHistoryItemSchema = z.object({
  consultationId: z.string(),
  appointmentId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  doctor: counterpartDtoSchema,
  diagnosis: z.string().nullable(),
});
export type ConsultationHistoryItemDto = z.infer<typeof consultationHistoryItemSchema>;

export const createMedicalRecordRequestSchema = z.object({
  consultationId: z.string(),
  patientId: z.string(),
  notes: z.string(),
  diagnosis: z.string().optional(),
  prescriptions: z.array(z.string()).optional(),
});
export type CreateMedicalRecordRequestDto = z.infer<typeof createMedicalRecordRequestSchema>;

export const medicalRecordSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  consultationId: z.string(),
  createdBy: z.string(),
  notes: z.string(),
  diagnosis: z.string().nullable(),
  prescriptions: z.array(z.string()),
  createdAt: z.string(),
});
export type MedicalRecordDto = z.infer<typeof medicalRecordSchema>;

export const medicalRecordSummarySchema = z.object({
  id: z.string(),
  consultationId: z.string(),
  createdAt: z.string(),
  diagnosis: z.string().nullable(),
});
export type MedicalRecordSummaryDto = z.infer<typeof medicalRecordSummarySchema>;

export const patientOverviewSchema = z.object({
  patient: userDtoSchema,
  upcomingAppointment: appointmentSchema.nullable(),
  history: z.array(medicalRecordSummarySchema),
  preConsult: z.array(preConsultAnswerSchema),
});
export type PatientOverviewDto = z.infer<typeof patientOverviewSchema>;

export const attachmentSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
  consultationId: z.string().nullable(),
  uploaderId: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  kind: attachmentKindSchema,
  downloadUrl: z.string(),
  createdAt: z.string(),
});
export type AttachmentDto = z.infer<typeof attachmentSchema>;

export const doctorAppointmentListSchema = z.array(doctorAppointmentSchema);
export const preConsultAnswerListSchema = z.array(preConsultAnswerSchema);
export const consultationHistoryListSchema = z.array(consultationHistoryItemSchema);
export const medicalRecordSummaryListSchema = z.array(medicalRecordSummarySchema);
