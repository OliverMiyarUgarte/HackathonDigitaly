import { ApiPropertyOptional } from '@nestjs/swagger';
import type { LogoutRequestDto as LogoutRequest } from '@telemed/service-contracts';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LogoutRequestDto implements LogoutRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
