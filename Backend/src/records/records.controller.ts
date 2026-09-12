import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ConsultationHistoryItemDto,
  MedicalRecordDto,
  PatientOverviewDto,
  PreConsultAnswerDto,
} from '@telemed/service-contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateMedicalRecordRequestDto } from './dto/create-medical-record-request.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { PreConsultAnswerInputDto } from './dto/pre-consult-answer-input.dto';
import { RecordsService } from './records.service';

@ApiTags('records')
@ApiBearerAuth()
@Controller()
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @ApiOperation({
    summary: 'Get a patient overview for a linked doctor or the patient',
  })
  @Get('patients/:patientId/overview')
  getPatientOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<PatientOverviewDto> {
    return this.recordsService.getPatientOverview(user, patientId);
  }

  @ApiOperation({ summary: 'Get pre-consult answers for an appointment' })
  @Get('appointments/:id/pre-consult')
  getPreConsult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreConsultAnswerDto[]> {
    return this.recordsService.getPreConsult(user, id);
  }

  @Roles('patient')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or replace pre-consult answers' })
  @Put('appointments/:id/pre-consult')
  putPreConsult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ParseArrayPipe({
        items: PreConsultAnswerInputDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    answers: PreConsultAnswerInputDto[],
  ): Promise<PreConsultAnswerDto[]> {
    return this.recordsService.putPreConsult(user, id, answers);
  }

  @ApiOperation({
    summary: 'List consultation history for the patient or doctor',
  })
  @Get('records/history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: HistoryQueryDto,
  ): Promise<ConsultationHistoryItemDto[]> {
    return this.recordsService.getHistory(user, query);
  }

  @Roles('doctor')
  @ApiOperation({ summary: 'Create a medical record for a consultation' })
  @Post('records')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicalRecordRequestDto,
  ): Promise<MedicalRecordDto> {
    return this.recordsService.create(user, dto);
  }

  @ApiOperation({ summary: 'Get one medical record' })
  @Get('records/:recordId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ): Promise<MedicalRecordDto> {
    return this.recordsService.findOne(user, recordId);
  }
}
