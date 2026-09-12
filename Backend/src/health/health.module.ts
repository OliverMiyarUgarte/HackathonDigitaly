import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, ReadinessController],
  providers: [ReadinessService],
})
export class HealthModule {}
