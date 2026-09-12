import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AuthResponseDto,
  AuthTokensDto,
  UserDto,
} from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_PASSWORD = 'Demo@1234';
const DEMO_USERS = [
  { email: 'medico@digitaly.health', role: 'doctor' },
  { email: 'paciente@digitaly.health', role: 'patient' },
] as const;

function expectNoPasswordHash(body: unknown): void {
  expect(JSON.stringify(body)).not.toContain('passwordHash');
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const startedAt = new Date();
  const email = `e2e+${Date.now()}@digitaly.health`;
  const password = 'E2e-Password-1234';
  let userId: string | null = null;
  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    const demoUsers = await prisma.user.findMany({
      where: { email: { in: DEMO_USERS.map((user) => user.email) } },
      select: { id: true },
    });
    if (demoUsers.length > 0) {
      await prisma.refreshToken.deleteMany({
        where: {
          userId: { in: demoUsers.map((user) => user.id) },
          createdAt: { gte: startedAt },
        },
      });
    }
    await app.close();
  });

  it('registers a unique user and returns a token pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'E2E Patient', email, password, role: 'patient' })
      .expect(201);

    const body = response.body as AuthResponseDto;
    userId = body.user.id;
    accessToken = body.tokens.accessToken;
    refreshToken = body.tokens.refreshToken;

    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('patient');
    expect(body.tokens.tokenType).toBe('Bearer');
    expect(body.tokens.expiresIn).toBeGreaterThan(0);
    expectNoPasswordHash(body);
  });

  it('rejects /auth/me without a token', () => {
    return request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'UNAUTHENTICATED' });
        expectNoPasswordHash(response.body);
      });
  });

  it('returns the current user for a valid access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as UserDto;
    expect(body.id).toBe(userId);
    expect(body.email).toBe(email);
    expectNoPasswordHash(body);
  });

  it('logs in with the registered credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const body = response.body as AuthResponseDto;
    accessToken = body.tokens.accessToken;
    refreshToken = body.tokens.refreshToken;
    expect(body.user.email).toBe(email);
    expectNoPasswordHash(body);
  });

  it('rotates the refresh token and rejects the old one', async () => {
    const previousRefreshToken = refreshToken;
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: previousRefreshToken })
      .expect(200);

    const tokens = response.body as AuthTokensDto;
    expect(tokens.accessToken.length).toBeGreaterThan(0);
    expect(tokens.refreshToken).not.toBe(previousRefreshToken);
    expectNoPasswordHash(tokens);
    refreshToken = tokens.refreshToken;

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: previousRefreshToken })
      .expect(401)
      .expect((rejected) => {
        expect(rejected.body).toMatchObject({
          error: 'INVALID_REFRESH_TOKEN',
        });
        expectNoPasswordHash(rejected.body);
      });
  });

  it('revokes the refresh token on logout', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401)
      .expect((rejected) => {
        expect(rejected.body).toMatchObject({
          error: 'INVALID_REFRESH_TOKEN',
        });
        expectNoPasswordHash(rejected.body);
      });
  });

  it('allows seeded demo users to log in with the demo password', async () => {
    for (const demo of DEMO_USERS) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: demo.email, password: DEMO_PASSWORD })
        .expect(200);

      const body = response.body as AuthResponseDto;
      expect(body.user.email).toBe(demo.email);
      expect(body.user.role).toBe(demo.role);
      expectNoPasswordHash(body);
    }
  });
});

describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps the throttler limit to a 429 RATE_LIMITED error', async () => {
    const credentials = {
      email: 'rate-limit@example.test',
      password: 'Password123',
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(credentials)
      .expect(429)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'RATE_LIMITED' });
        expectNoPasswordHash(response.body);
      });
  });
});
