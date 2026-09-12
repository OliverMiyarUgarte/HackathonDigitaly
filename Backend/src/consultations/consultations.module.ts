import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';

@Module({
  imports: [AppointmentsModule, RealtimeModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
