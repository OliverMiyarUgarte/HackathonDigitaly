import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { ReadyResponseDto } from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ReadinessService } from '../src/health/readiness.service';

describe('Readiness (e2e)', () => {
  let app: INestApplication<App>;
  let check: jest.Mock;

  beforeEach(async () => {
    check = jest.fn();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ReadinessService)
      .useValue({ check })
      .compile();

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

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/ready returns 200 and degraded when only the AI is down', () => {
    check.mockResolvedValue({
      status: 'degraded',
      checks: { database: 'up', ai: 'down' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    return request(app.getHttpServer())
      .get('/api/ready')
      .expect(200)
      .expect((response) => {
        const body = response.body as ReadyResponseDto;
        expect(body.status).toBe('degraded');
        expect(body.checks).toEqual({ database: 'up', ai: 'down' });
        expect(response.headers['x-correlation-id']).toBeDefined();
      });
  });

  it('GET /api/ready returns 503 when the database is down', () => {
    check.mockResolvedValue({
      status: 'degraded',
      checks: { database: 'down', ai: 'up' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    return request(app.getHttpServer())
      .get('/api/ready')
      .expect(503)
      .expect((response) => {
        const body = response.body as ReadyResponseDto;
        expect(body.status).toBe('degraded');
        expect(body.checks.database).toBe('down');
      });
  });
});
