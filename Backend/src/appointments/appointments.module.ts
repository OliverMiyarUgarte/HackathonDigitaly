import { Module } from '@nestjs/common';
import { AppointmentAccessService } from './appointment-access.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { SlotsService } from './slots.service';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, SlotsService, AppointmentAccessService],
  exports: [AppointmentAccessService],
})
export class AppointmentsModule {}
