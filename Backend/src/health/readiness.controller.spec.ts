import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './readiness.service';

describe('ReadinessController', () => {
  let controller: ReadinessController;
  let check: jest.Mock;

  beforeEach(async () => {
    check = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadinessController],
      providers: [
        {
          provide: ReadinessService,
          useValue: { check },
        },
      ],
    }).compile();

    controller = module.get<ReadinessController>(ReadinessController);
  });

  it('does not override the status when the database is up', async () => {
    check.mockResolvedValue({
      status: 'degraded',
      checks: { database: 'up', ai: 'down' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const { response, status } = createResponse();

    const result = await controller.check(response);

    expect(status).not.toHaveBeenCalled();
    expect(result.checks).toEqual({ database: 'up', ai: 'down' });
  });

  it('sets 503 when the database is down', async () => {
    check.mockResolvedValue({
      status: 'degraded',
      checks: { database: 'down', ai: 'up' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const { response, status } = createResponse();

    const result = await controller.check(response);

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe('down');
  });
});

function createResponse(): { response: Response; status: jest.Mock } {
  const status = jest.fn().mockReturnThis();
  return { response: { status } as unknown as Response, status };
}
