import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AppointmentDto,
  CalendarEntryDto,
  DoctorAppointmentDto,
  SlotDto,
} from '@telemed/service-contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AppointmentsService } from './appointments.service';
import { CancelAppointmentRequestDto } from './dto/cancel-appointment-request.dto';
import { CreateAppointmentRequestDto } from './dto/create-appointment-request.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { DoctorAppointmentsQueryDto } from './dto/doctor-appointments-query.dto';
import { SlotsService } from './slots.service';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly slotsService: SlotsService,
  ) {}

  @Roles('patient')
  @ApiOperation({ summary: 'List bookable slots for a doctor' })
  @Get('doctors/:doctorId/slots')
  listSlots(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<SlotDto[]> {
    return this.slotsService.getSlots(
      doctorId,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Roles('patient')
  @ApiOperation({
    summary: 'Create a pending appointment and optional pre-consult answers',
  })
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentRequestDto,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.create(user, dto);
  }

  @Roles('patient')
  @ApiOperation({
    summary: 'List calendar entries for the authenticated patient',
  })
  @Get('calendar')
  calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<CalendarEntryDto[]> {
    return this.appointmentsService.calendar(
      user,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Roles('doctor')
  @ApiOperation({
    summary: 'List appointments for the authenticated doctor',
  })
  @Get('doctor')
  doctorList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DoctorAppointmentsQueryDto,
  ): Promise<DoctorAppointmentDto[]> {
    return this.appointmentsService.doctorList(
      user,
      query.date ? new Date(query.date) : undefined,
      query.status,
    );
  }

  @ApiOperation({ summary: 'Get one appointment' })
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.findOne(user, id);
  }

  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an appointment' })
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentRequestDto,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.cancel(user, id, dto);
  }
}
