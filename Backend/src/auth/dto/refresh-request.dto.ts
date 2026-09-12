import { ApiProperty } from '@nestjs/swagger';
import type { RefreshRequestDto as RefreshRequest } from '@telemed/service-contracts';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshRequestDto implements RefreshRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
