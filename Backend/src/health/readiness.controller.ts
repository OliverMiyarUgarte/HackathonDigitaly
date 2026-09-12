import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ReadyResponseDto } from '@telemed/service-contracts';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ReadinessService } from './readiness.service';

@ApiTags('health')
@Public()
@Controller('ready')
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService) {}

  @ApiOperation({ summary: 'Readiness probe for downstream dependencies' })
  @ApiOkResponse({
    description:
      'Dependencies are ready, or only the AI copilot is unavailable',
    schema: {
      example: {
        status: 'ok',
        checks: { database: 'up', ai: 'up' },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'The database is unavailable',
    schema: {
      example: {
        status: 'degraded',
        checks: { database: 'down', ai: 'up' },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  @Get()
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadyResponseDto> {
    const result = await this.readiness.check();
    if (result.checks.database === 'down') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
