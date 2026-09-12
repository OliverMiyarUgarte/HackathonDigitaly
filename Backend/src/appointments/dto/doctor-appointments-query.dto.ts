import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '@telemed/service-contracts';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class DoctorAppointmentsQueryDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({
    enum: APPOINTMENT_STATUSES,
    enumName: 'AppointmentStatus',
  })
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES)
  status?: AppointmentStatus;
}
