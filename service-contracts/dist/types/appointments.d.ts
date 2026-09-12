import type { AppointmentStatus } from './common';
import type { CounterpartDto } from './users';
export interface SlotDto {
    startsAt: string;
    endsAt: string;
    doctorId: string;
}
export interface PreConsultAnswerInputDto {
    questionKey: string;
    answer: string;
}
export interface PreConsultAnswerDto {
    id: string;
    appointmentId: string;
    questionKey: string;
    answer: string;
    createdAt: string;
}
export interface CreateAppointmentRequestDto {
    doctorId: string;
    scheduledAt: string;
    preConsult?: PreConsultAnswerInputDto[];
}
export interface RequestCodeResponseDto {
    appointmentId: string;
    expiresAt: string;
    attemptsRemaining: number;
}
export interface VerifyCodeRequestDto {
    code: string;
}
export interface AppointmentDto {
    id: string;
    patientId: string;
    doctorId: string;
    scheduledAt: string;
    status: AppointmentStatus;
    createdAt: string;
    updatedAt: string;
}
export interface CalendarEntryDto {
    appointmentId: string;
    scheduledAt: string;
    status: AppointmentStatus;
    counterpart: CounterpartDto;
    consultationId: string | null;
    isCurrent: boolean;
}
export interface DoctorAppointmentDto {
    appointmentId: string;
    scheduledAt: string;
    status: AppointmentStatus;
    patient: CounterpartDto;
    consultationId: string | null;
    hasPreConsult: boolean;
}
export interface CancelAppointmentRequestDto {
    reason?: string;
}
export declare const PRE_CONSULT_QUESTION_KEYS: readonly ["chief_complaint", "symptom_duration", "current_medications", "allergies", "medical_history"];
export type PreConsultQuestionKey = (typeof PRE_CONSULT_QUESTION_KEYS)[number];
//# sourceMappingURL=appointments.d.ts.map