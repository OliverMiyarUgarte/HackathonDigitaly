import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateMedicalRecordRequestDto as CreateMedicalRecordRequest } from '@telemed/service-contracts';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

const MAX_PRESCRIPTIONS = 50;
const MAX_DIAGNOSIS_LENGTH = 2000;

export class CreateMedicalRecordRequestDto implements CreateMedicalRecordRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consultationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @Length(1, 5000)
  notes!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: MAX_DIAGNOSIS_LENGTH })
  @IsOptional()
  @IsString()
  @Length(1, MAX_DIAGNOSIS_LENGTH)
  diagnosis?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRESCRIPTIONS)
  @IsString({ each: true })
  prescriptions?: string[];
}
