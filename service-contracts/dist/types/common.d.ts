export declare const USER_ROLES: readonly ["doctor", "patient"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const APPOINTMENT_STATUSES: readonly ["pending_code", "confirmed", "in_progress", "completed", "cancelled"];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type ConsultationStatus = 'active' | 'ended';
export type FeedbackSeverity = 'info' | 'warning' | 'critical';
export type AttachmentKind = 'document' | 'image' | 'other';
export type HealthStatus = 'ok' | 'degraded';
export type DependencyStatus = 'up' | 'down' | 'unknown';
export type ErrorCode = 'VALIDATION_FAILED' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS' | 'INVALID_REFRESH_TOKEN' | 'INVALID_OR_EXPIRED_CODE' | 'TOO_MANY_ATTEMPTS' | 'RATE_LIMITED' | 'SLOT_TAKEN' | 'APPOINTMENT_NOT_CONFIRMED' | 'APPOINTMENT_TERMINAL' | 'CONSULTATION_EXISTS' | 'CONSULTATION_NOT_ACTIVE' | 'RECORD_EXISTS' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'AI_UNAVAILABLE' | 'INTERNAL_ERROR';
export interface ErrorResponseDto {
    statusCode: number;
    error: string;
    message: string;
    details: string[] | null;
    timestamp: string;
    path: string;
    correlationId: string;
}
export interface HealthResponseDto {
    status: 'ok';
    uptimeSeconds: number;
    timestamp: string;
    version: string;
}
export interface ReadyResponseDto {
    status: HealthStatus;
    checks: {
        database: DependencyStatus;
        ai: DependencyStatus;
    };
    timestamp: string;
}
//# sourceMappingURL=common.d.ts.map