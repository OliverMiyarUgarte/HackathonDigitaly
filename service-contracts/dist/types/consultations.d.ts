import type { ConsultationStatus, UserRole } from './common';
import type { CounterpartDto } from './users';
export interface IceServerDto {
    urls: string[];
    username?: string;
    credential?: string;
}
export interface ParticipantDto {
    userId: string;
    role: UserRole;
    joinedAt: string | null;
}
export interface StartConsultationResponseDto {
    consultationId: string;
    appointmentId: string;
    status: ConsultationStatus;
    startedAt: string;
    roomId: string;
    iceServers: IceServerDto[];
    participants: ParticipantDto[];
}
export interface ConsultationDto {
    id: string;
    appointmentId: string;
    status: ConsultationStatus;
    startedAt: string;
    endedAt: string | null;
}
export interface EndConsultationResponseDto {
    consultationId: string;
    appointmentId: string;
    status: ConsultationStatus;
    startedAt: string;
    endedAt: string;
}
export interface ConsultationHistoryItemDto {
    consultationId: string;
    appointmentId: string;
    startedAt: string;
    endedAt: string | null;
    doctor: CounterpartDto;
    diagnosis: string | null;
}
export interface ConsultationSummaryDto {
    consultationId: string;
    doctorSummary: string;
    patientSummary: string;
    generatedAt: string;
}
//# sourceMappingURL=consultations.d.ts.map