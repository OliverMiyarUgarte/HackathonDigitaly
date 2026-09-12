import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokensDto } from '@telemed/service-contracts';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

export interface IssuedTokens {
  tokens: AuthTokensDto;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d|w)?$/;
const UNIT_MILLISECONDS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueTokens(user: AuthenticatedUser): Promise<IssuedTokens> {
    const accessTokenTtl =
      this.configService.getOrThrow<string>('JWT_EXPIRES_IN');
    const accessToken = await this.jwtService.signAsync(
      { sub: user.sub, role: user.role },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessTokenTtl as JwtSignOptions['expiresIn'],
      },
    );
    const refreshToken = this.generateRefreshToken();

    return {
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.parseDurationToSeconds(accessTokenTtl),
      },
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      refreshTokenExpiresAt: this.getRefreshTokenExpiresAt(),
    };
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getAccessTokenTtlSeconds(): number {
    return this.parseDurationToSeconds(
      this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
    );
  }

  getRefreshTokenExpiresAt(): Date {
    return new Date(
      Date.now() +
        this.parseDurationToMilliseconds(
          this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
        ),
    );
  }

  parseDurationToMilliseconds(value: string): number {
    const match = DURATION_PATTERN.exec(value.trim());
    if (!match) {
      throw new Error('Invalid duration value');
    }
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2] ?? 's';
    return amount * UNIT_MILLISECONDS[unit];
  }

  parseDurationToSeconds(value: string): number {
    return Math.floor(this.parseDurationToMilliseconds(value) / 1_000);
  }
}
