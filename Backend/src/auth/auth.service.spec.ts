import { ConflictException, HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { argon2id, hash } from 'argon2';
import type { AuthTokensDto } from '@telemed/service-contracts';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  Prisma,
  type RefreshToken,
  type User,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { LoginRequestDto } from './dto/login-request.dto';
import type { RefreshRequestDto } from './dto/refresh-request.dto';
import type { RegisterRequestDto } from './dto/register-request.dto';
import type { IssuedTokens, TokenService } from './token.service';

type UserDelegateMock = {
  findUnique: jest.Mock<Promise<User | null>, [unknown]>;
  create: jest.Mock<Promise<User>, [unknown]>;
};

type RefreshTokenDelegateMock = {
  findUnique: jest.Mock<Promise<RefreshToken | null>, [unknown]>;
  create: jest.Mock<Promise<RefreshToken>, [unknown]>;
  update: jest.Mock<Promise<RefreshToken>, [unknown]>;
  updateMany: jest.Mock<Promise<{ count: number }>, [unknown]>;
};

interface PrismaMock {
  $transaction: jest.Mock<
    Promise<unknown>,
    [(tx: PrismaMock) => Promise<unknown>]
  >;
  user: UserDelegateMock;
  refreshToken: RefreshTokenDelegateMock;
}

interface TokenServiceMock {
  issueTokens: jest.Mock<Promise<IssuedTokens>, [AuthenticatedUser]>;
  hashRefreshToken: jest.Mock<string, [string]>;
}

interface ConfigMock {
  get: jest.Mock<boolean, [string, boolean]>;
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    role: 'patient',
    name: 'Test Patient',
    email: 'patient@example.test',
    passwordHash: 'stored-hash',
    specialty: null,
    crm: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function buildRefreshToken(
  overrides: Partial<RefreshToken> = {},
): RefreshToken {
  return {
    id: 'token-1',
    userId: 'user-1',
    tokenHash: 'stored-hash',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildTokens(overrides: Partial<AuthTokensDto> = {}): AuthTokensDto {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    ...overrides,
  };
}

function buildIssued(overrides: Partial<IssuedTokens> = {}): IssuedTokens {
  return {
    tokens: buildTokens(),
    refreshTokenHash: 'new-hash',
    refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: PrismaMock) => Promise<unknown>]
    >(),
    user: {
      findUnique: jest.fn<Promise<User | null>, [unknown]>(),
      create: jest.fn<Promise<User>, [unknown]>(),
    },
    refreshToken: {
      findUnique: jest.fn<Promise<RefreshToken | null>, [unknown]>(),
      create: jest.fn<Promise<RefreshToken>, [unknown]>(),
      update: jest.fn<Promise<RefreshToken>, [unknown]>(),
      updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
    },
  };
  mock.$transaction.mockImplementation((callback) => callback(mock));
  return mock;
}

function createConfigMock(): ConfigMock {
  return {
    get: jest.fn<boolean, [string, boolean]>((_key, fallback) => fallback),
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
  });
}

function createTokenServiceMock(): TokenServiceMock {
  return {
    issueTokens: jest.fn<Promise<IssuedTokens>, [AuthenticatedUser]>(),
    hashRefreshToken: jest.fn<string, [string]>(),
  };
}

async function expectHttpError(
  promise: Promise<unknown>,
): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected request to fail');
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let tokenService: TokenServiceMock;
  let config: ConfigMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    tokenService = createTokenServiceMock();
    config = createConfigMock();
    service = new AuthService(
      prisma as unknown as PrismaService,
      tokenService as unknown as TokenService,
      config as unknown as ConfigService,
    );
    tokenService.issueTokens.mockResolvedValue(buildIssued());
    tokenService.hashRefreshToken.mockReturnValue('stored-hash');
  });

  describe('register', () => {
    it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const error = await expectHttpError(
        service.register({
          name: 'Duplicate',
          email: 'Duplicate@Example.com',
          password: 'Password123',
          role: 'patient',
        } satisfies RegisterRequestDto),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: 'EMAIL_TAKEN' });
    });

    it('creates a session without exposing passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser());
      prisma.refreshToken.create.mockResolvedValue(buildRefreshToken());

      const result = await service.register({
        name: 'New Patient',
        email: 'New@Example.com',
        password: 'Password123',
        role: 'patient',
      } satisfies RegisterRequestDto);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens).toEqual(buildTokens());
      expect(tokenService.issueTokens).toHaveBeenCalledWith({
        sub: 'user-1',
        role: 'patient',
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          tokenHash: 'new-hash',
          expiresAt: expect.any(Date) as Date,
        },
      });
    });

    it('rejects doctor self-registration when the flag is disabled', async () => {
      const error = await expectHttpError(
        service.register({
          name: 'Dr. No One',
          email: 'doctor@example.test',
          password: 'Password123',
          role: 'doctor',
          specialty: 'Cardiologia',
          crm: 'CRM-SP 000000',
        } satisfies RegisterRequestDto),
      );

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ errorCode: 'FORBIDDEN' });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('allows doctor self-registration when the flag is enabled', async () => {
      config.get.mockReturnValue(true);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(
        buildUser({
          id: 'doctor-1',
          role: 'doctor',
          email: 'doctor@example.test',
          specialty: 'Cardiologia',
          crm: 'CRM-SP 000000',
        }),
      );
      prisma.refreshToken.create.mockResolvedValue(
        buildRefreshToken({ userId: 'doctor-1' }),
      );

      const result = await service.register({
        name: 'Dr. Someone',
        email: 'doctor@example.test',
        password: 'Password123',
        role: 'doctor',
        specialty: 'Cardiologia',
        crm: 'CRM-SP 000000',
      } satisfies RegisterRequestDto);

      expect(result.user.role).toBe('doctor');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('maps a unique constraint violation on create to 409 EMAIL_TAKEN', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(uniqueConstraintError());

      const error = await expectHttpError(
        service.register({
          name: 'Racer',
          email: 'race@example.test',
          password: 'Password123',
          role: 'patient',
        } satisfies RegisterRequestDto),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: 'EMAIL_TAKEN' });
    });
  });

  describe('login', () => {
    it('rejects an unknown user with a generic 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const error = await expectHttpError(
        service.login({
          email: 'missing@example.test',
          password: 'Password123',
        } satisfies LoginRequestDto),
      );

      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('rejects a wrong password with a generic 401', async () => {
      const passwordHash = await hash('CorrectPassword123', { type: argon2id });
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));

      const error = await expectHttpError(
        service.login({
          email: 'patient@example.test',
          password: 'WrongPassword123',
        } satisfies LoginRequestDto),
      );

      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });
  });

  describe('refresh', () => {
    it('rejects an unknown token with 401 INVALID_REFRESH_TOKEN', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      const error = await expectHttpError(
        service.refresh({
          refreshToken: 'unknown',
        } satisfies RefreshRequestDto),
      );

      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('revokes the whole family when a revoked token is reused', async () => {
      const stored = buildRefreshToken({
        userId: 'user-1',
        revokedAt: new Date(),
      });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const error = await expectHttpError(
        service.refresh({
          refreshToken: 'revoked',
        } satisfies RefreshRequestDto),
      );

      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_REFRESH_TOKEN',
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('rejects an expired token with 401 INVALID_REFRESH_TOKEN', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        buildRefreshToken({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      const error = await expectHttpError(
        service.refresh({
          refreshToken: 'expired',
        } satisfies RefreshRequestDto),
      );

      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('rotates the token when the presented token is valid', async () => {
      const stored = buildRefreshToken({ tokenHash: 'stored-hash' });
      const issued = buildIssued({
        tokens: buildTokens({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
        refreshTokenHash: 'rotated-hash',
      });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.create.mockResolvedValue(buildRefreshToken());
      tokenService.issueTokens.mockResolvedValue(issued);

      const tokens = await service.refresh({
        refreshToken: 'presented',
      } satisfies RefreshRequestDto);

      expect(tokens).toEqual(issued.tokens);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: stored.userId,
          tokenHash: 'rotated-hash',
          expiresAt: issued.refreshTokenExpiresAt,
        },
      });
    });

    it('does not issue a pair and revokes the family when the conditional update loses the race', async () => {
      const stored = buildRefreshToken({ tokenHash: 'stored-hash' });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const error = await expectHttpError(
        service.refresh({
          refreshToken: 'presented',
        } satisfies RefreshRequestDto),
      );

      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_REFRESH_TOKEN',
      });
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });
});
