import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRE_CONSULT_QUESTION_KEYS,
  type CreateAppointmentRequestDto as CreateAppointmentRequest,
} from '@telemed/service-contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PreConsultAnswerInputDto } from './pre-consult-answer-input.dto';

export class CreateAppointmentRequestDto implements CreateAppointmentRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  doctorId!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ type: [PreConsultAnswerInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PRE_CONSULT_QUESTION_KEYS.length)
  @ValidateNested({ each: true })
  @Type(() => PreConsultAnswerInputDto)
  preConsult?: PreConsultAnswerInputDto[];
}
