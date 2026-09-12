import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { AppointmentStatus } from '../../generated/prisma/enums';

export class DoctorAppointmentsQueryDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({
    enum: AppointmentStatus,
    enumName: 'AppointmentStatus',
  })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
