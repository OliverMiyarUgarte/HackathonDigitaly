import { ApiProperty } from '@nestjs/swagger';
import type { LoginRequestDto as LoginRequest } from '@telemed/service-contracts';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginRequestDto implements LoginRequest {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 72 })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
