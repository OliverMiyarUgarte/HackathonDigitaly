import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AppointmentsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
