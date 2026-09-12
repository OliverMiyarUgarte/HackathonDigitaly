import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UpdateUserRequestDto as UpdateUserRequest } from '@telemed/service-contracts';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserRequestDto implements UpdateUserRequest {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  specialty?: string;
}
