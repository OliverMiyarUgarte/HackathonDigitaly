import type { AppointmentDto, PreConsultAnswerDto } from './appointments';
import type { UserDto } from './users';

export interface CreateMedicalRecordRequestDto {
  consultationId: string;
  patientId: string;
  notes: string;
  diagnosis?: string;
  prescriptions?: string[];
}

export interface MedicalRecordDto {
  id: string;
  patientId: string;
  consultationId: string;
  createdBy: string;
  notes: string;
  diagnosis: string | null;
  prescriptions: string[];
  createdAt: string;
}

export interface MedicalRecordSummaryDto {
  id: string;
  consultationId: string;
  createdAt: string;
  diagnosis: string | null;
}

export interface PatientOverviewDto {
  patient: UserDto;
  upcomingAppointment: AppointmentDto | null;
  history: MedicalRecordSummaryDto[];
  preConsult: PreConsultAnswerDto[];
}
