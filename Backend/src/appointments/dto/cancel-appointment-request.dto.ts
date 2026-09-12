import { ApiPropertyOptional } from '@nestjs/swagger';
import type { CancelAppointmentRequestDto as CancelAppointmentRequest } from '@telemed/service-contracts';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAppointmentRequestDto implements CancelAppointmentRequest {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
