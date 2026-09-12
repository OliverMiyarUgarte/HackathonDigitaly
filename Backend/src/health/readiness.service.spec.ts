import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { ReadyResponseDto } from '@telemed/service-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ReadinessService } from './readiness.service';

describe('ReadinessService', () => {
  let service: ReadinessService;
  let queryRaw: jest.Mock;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    queryRaw = jest.fn();
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://ai:8000'),
          },
        },
      ],
    }).compile();

    service = module.get<ReadinessService>(ReadinessService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns ok when the database and AI are up', async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);
    fetchMock.mockResolvedValue({ ok: true });

    const result: ReadyResponseDto = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ database: 'up', ai: 'up' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ai:8000/health',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(typeof result.timestamp).toBe('string');
  });

  it('returns degraded with the database down when the ping fails', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    fetchMock.mockResolvedValue({ ok: true });

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks).toEqual({ database: 'down', ai: 'up' });
  });

  it('returns degraded with the AI down when the service is unreachable', async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);
    fetchMock.mockRejectedValue(new Error('fetch failed'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks).toEqual({ database: 'up', ai: 'down' });
  });

  it('returns degraded with the AI down when the service responds with an error', async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);
    fetchMock.mockResolvedValue({ ok: false });

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks).toEqual({ database: 'up', ai: 'down' });
  });
});
