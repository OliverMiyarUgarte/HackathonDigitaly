import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [AppointmentsModule],
  controllers: [RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
