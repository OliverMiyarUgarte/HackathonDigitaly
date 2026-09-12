import type { UserRole } from './common';
import type { UserDto } from './users';

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface RegisterRequestDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  specialty?: string;
  crm?: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface RefreshRequestDto {
  refreshToken: string;
}

export interface LogoutRequestDto {
  refreshToken?: string;
}

export interface AuthResponseDto {
  user: UserDto;
  tokens: AuthTokensDto;
}
