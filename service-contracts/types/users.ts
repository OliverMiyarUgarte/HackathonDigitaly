import type { UserRole } from './common';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  specialty: string | null;
  crm: string | null;
  createdAt: string;
}

export interface DoctorSummaryDto {
  id: string;
  name: string;
  specialty: string | null;
  crm: string | null;
}

export interface CounterpartDto {
  id: string;
  name: string;
  role: UserRole;
  specialty: string | null;
}

export interface UpdateUserRequestDto {
  name?: string;
  specialty?: string;
}
