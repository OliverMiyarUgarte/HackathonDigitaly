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
import { Throttle } from '@nestjs/throttler';
import type {
  AppointmentDto,
  CalendarEntryDto,
  DoctorAppointmentDto,
  RequestCodeResponseDto,
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
import { VerifyCodeRequestDto } from './dto/verify-code-request.dto';
import { SlotsService } from './slots.service';
import { ValidationCodeService } from './validation-code.service';

const CODE_REQUEST_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const CODE_VERIFY_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly slotsService: SlotsService,
    private readonly validationCodeService: ValidationCodeService,
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

  @Roles('patient')
  @Throttle(CODE_REQUEST_THROTTLE)
  @ApiOperation({
    summary: 'Issue an email validation code for a pending appointment',
  })
  @HttpCode(HttpStatus.OK)
  @Post(':id/request-code')
  requestCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RequestCodeResponseDto> {
    return this.validationCodeService.request(user, id);
  }

  @Roles('patient')
  @Throttle(CODE_REQUEST_THROTTLE)
  @ApiOperation({
    summary: 'Invalidate and reissue the validation code',
  })
  @HttpCode(HttpStatus.OK)
  @Post(':id/resend-code')
  resendCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RequestCodeResponseDto> {
    return this.validationCodeService.resend(user, id);
  }

  @Roles('patient')
  @Throttle(CODE_VERIFY_THROTTLE)
  @ApiOperation({ summary: 'Confirm the appointment with the emailed code' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/verify-code')
  verifyCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyCodeRequestDto,
  ): Promise<AppointmentDto> {
    return this.validationCodeService.verify(user, id, dto);
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
