import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AppointmentAccessService } from './appointment-access.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { SlotsService } from './slots.service';
import { ValidationCodeService } from './validation-code.service';

@Module({
  imports: [MailModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    SlotsService,
    AppointmentAccessService,
    ValidationCodeService,
  ],
  exports: [AppointmentAccessService],
})
export class AppointmentsModule {}
