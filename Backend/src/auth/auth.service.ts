import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthResponseDto,
  AuthTokensDto,
  UserDto,
} from '@telemed/service-contracts';
import { argon2id, hash, verify } from 'argon2';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginRequestDto } from './dto/login-request.dto';
import type { LogoutRequestDto } from './dto/logout-request.dto';
import type { RefreshRequestDto } from './dto/refresh-request.dto';
import type { RegisterRequestDto } from './dto/register-request.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterRequestDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: 'EMAIL_TAKEN',
        message: 'Email already registered',
      });
    }

    const passwordHash = await hash(dto.password, { type: argon2id });
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash,
        role: dto.role,
        specialty:
          dto.role === 'doctor' ? (dto.specialty?.trim() ?? null) : null,
        crm: dto.role === 'doctor' ? (dto.crm?.trim() ?? null) : null,
      },
    });

    return this.createSession(user);
  }

  async login(dto: LoginRequestDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      throw this.invalidCredentials();
    }

    const matches = await this.verifyPassword(user.passwordHash, dto.password);
    if (!matches) {
      throw this.invalidCredentials();
    }

    return this.createSession(user);
  }

  async refresh(dto: RefreshRequestDto): Promise<AuthTokensDto> {
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() <= Date.now()
    ) {
      throw this.invalidRefreshToken();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user || user.deletedAt) {
      throw this.invalidRefreshToken();
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const issued = await this.tokenService.issueTokens({
      sub: user.id,
      role: user.role,
    });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: issued.refreshTokenHash,
        expiresAt: issued.refreshTokenExpiresAt,
      },
    });

    return issued.tokens;
  }

  async logout(dto: LogoutRequestDto): Promise<void> {
    if (!dto.refreshToken) {
      return;
    }
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(authenticatedUser: AuthenticatedUser): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: authenticatedUser.sub },
    });
    if (!user || user.deletedAt) {
      throw this.unauthenticated();
    }
    return toUserDto(user);
  }

  private async createSession(user: User): Promise<AuthResponseDto> {
    const issued = await this.tokenService.issueTokens({
      sub: user.id,
      role: user.role,
    });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: issued.refreshTokenHash,
        expiresAt: issued.refreshTokenExpiresAt,
      },
    });
    return { user: toUserDto(user), tokens: issued.tokens };
  }

  private async verifyPassword(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      errorCode: 'INVALID_REFRESH_TOKEN',
      message: 'Invalid refresh token',
    });
  }

  private unauthenticated(): UnauthorizedException {
    return new UnauthorizedException({
      errorCode: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
  }
}

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    specialty: user.specialty,
    crm: user.crm,
    createdAt: user.createdAt.toISOString(),
  };
}
