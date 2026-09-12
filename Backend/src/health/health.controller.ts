import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponseDto } from '@telemed/service-contracts';
import { APP_VERSION } from '../common/constants/app-version';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    description: 'The service process is alive',
    schema: {
      example: {
        status: 'ok',
        uptimeSeconds: 12,
        timestamp: '2026-01-01T00:00:00.000Z',
        version: APP_VERSION,
      },
    },
  })
  @Get()
  check(): HealthResponseDto {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };
  }
}
