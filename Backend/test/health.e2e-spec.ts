import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
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

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns the contract liveness payload', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          status: string;
          uptimeSeconds: number;
          timestamp: string;
          version: string;
        };
        expect(body.status).toBe('ok');
        expect(typeof body.uptimeSeconds).toBe('number');
        expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
        expect(typeof body.version).toBe('string');
        expect(body.version.length).toBeGreaterThan(0);
        expect(response.headers['x-correlation-id']).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      });
  });

  it('GET /api/health preserves a provided x-correlation-id', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .set('x-correlation-id', 'e2e-correlation-id')
      .expect(200)
      .expect((response) => {
        expect(response.headers['x-correlation-id']).toBe('e2e-correlation-id');
      });
  });
});
