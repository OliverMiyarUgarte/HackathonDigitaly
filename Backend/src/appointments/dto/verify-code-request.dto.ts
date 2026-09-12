import { ApiProperty } from '@nestjs/swagger';
import type { VerifyCodeRequestDto as VerifyCodeRequest } from '@telemed/service-contracts';
import { IsString, Matches } from 'class-validator';

export class VerifyCodeRequestDto implements VerifyCodeRequest {
  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
