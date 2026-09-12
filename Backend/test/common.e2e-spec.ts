import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { ErrorResponseDto } from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Common HTTP concerns (e2e)', () => {
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

  it('maps an unknown route to the contract error shape', () => {
    return request(app.getHttpServer())
      .get('/api/does-not-exist')
      .expect(404)
      .expect((response) => {
        const body = response.body as ErrorResponseDto;
        expect(body).toMatchObject({
          statusCode: 404,
          error: 'NOT_FOUND',
          details: null,
          path: '/api/does-not-exist',
        });
        expect(typeof body.message).toBe('string');
        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
        expect(body.correlationId).toMatch(UUID_PATTERN);
      });
  });
});
