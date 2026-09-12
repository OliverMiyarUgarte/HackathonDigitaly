import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiProxyService } from './ai-proxy.service';

@Module({
  imports: [RealtimeModule],
  providers: [AiProxyService],
  exports: [AiProxyService],
})
export class AiModule {}
