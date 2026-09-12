import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthResponseDto,
  AuthTokensDto,
  UserDto,
} from '@telemed/service-contracts';
import { argon2id, hash, verify } from 'argon2';
import {
  AuditService,
  UNKNOWN_RESOURCE_ID,
} from '../common/audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { Prisma, type User } from '../generated/prisma/client';
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
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterRequestDto): Promise<AuthResponseDto> {
    if (dto.role === 'doctor' && !this.allowDoctorSelfRegistration()) {
      throw new ForbiddenException({
        errorCode: 'FORBIDDEN',
        message: 'Doctor self-registration is disabled',
      });
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw this.emailTaken();
    }

    const passwordHash = await hash(dto.password, { type: argon2id });
    let user: User;
    try {
      user = await this.prisma.user.create({
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
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw this.emailTaken();
      }
      throw error;
    }

    return this.createSession(user);
  }

  async login(dto: LoginRequestDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      await this.auditService.record({
        actorId: null,
        action: 'auth.login',
        resourceType: 'user',
        resourceId: UNKNOWN_RESOURCE_ID,
        outcome: 'denied',
      });
      throw this.invalidCredentials();
    }

    const matches = await this.verifyPassword(user.passwordHash, dto.password);
    if (!matches) {
      await this.auditService.record({
        actorId: null,
        action: 'auth.login',
        resourceType: 'user',
        resourceId: user.id,
        outcome: 'denied',
      });
      throw this.invalidCredentials();
    }

    const session = await this.createSession(user);
    await this.auditService.record({
      actorId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      outcome: 'success',
    });
    return session;
  }

  async refresh(dto: RefreshRequestDto): Promise<AuthTokensDto> {
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw this.invalidRefreshToken();
    }

    if (stored.revokedAt) {
      await this.auditService.record({
        actorId: stored.userId,
        action: 'auth.refresh.reuse_detected',
        resourceType: 'user',
        resourceId: stored.userId,
        outcome: 'denied',
      });
      await this.revokeAllActiveTokens(stored.userId);
      throw this.invalidRefreshToken();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user || user.deletedAt) {
      throw this.invalidRefreshToken();
    }

    const rotated = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        return null;
      }

      const issued = await this.tokenService.issueTokens({
        sub: user.id,
        role: user.role,
      });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: issued.refreshTokenHash,
          expiresAt: issued.refreshTokenExpiresAt,
        },
      });
      return issued.tokens;
    });

    if (!rotated) {
      await this.auditService.record({
        actorId: stored.userId,
        action: 'auth.refresh.reuse_detected',
        resourceType: 'user',
        resourceId: stored.userId,
        outcome: 'denied',
      });
      await this.revokeAllActiveTokens(stored.userId);
      throw this.invalidRefreshToken();
    }

    return rotated;
  }

  async logout(dto: LogoutRequestDto): Promise<void> {
    if (!dto.refreshToken) {
      return;
    }
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditService.record({
      actorId: stored?.userId ?? null,
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: stored?.userId ?? UNKNOWN_RESOURCE_ID,
      outcome: 'success',
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

  private allowDoctorSelfRegistration(): boolean {
    return this.configService.get<boolean>(
      'ALLOW_DOCTOR_SELF_REGISTRATION',
      false,
    );
  }

  private async revokeAllActiveTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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

  private emailTaken(): ConflictException {
    return new ConflictException({
      errorCode: 'EMAIL_TAKEN',
      message: 'Email already registered',
    });
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
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
