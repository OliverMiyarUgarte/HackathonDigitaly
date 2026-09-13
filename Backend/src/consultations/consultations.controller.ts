import {
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
  ConsultationDto,
  ConsultationHistoryItemDto,
  ConsultationSummaryDto,
  EndConsultationResponseDto,
  StartConsultationResponseDto,
} from '@telemed/service-contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ConsultationsService } from './consultations.service';
import { ListConsultationsQueryDto } from './dto/list-consultations-query.dto';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller()
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Roles('doctor')
  @ApiOperation({ summary: 'Start a consultation and get WebRTC ICE servers' })
  @Post('appointments/:id/consultations/start')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StartConsultationResponseDto> {
    return this.consultationsService.start(user, id);
  }

  @Roles('patient')
  @ApiOperation({
    summary: 'List the authenticated patient consultation history',
  })
  @Get('consultations/mine')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConsultationsQueryDto,
  ): Promise<ConsultationHistoryItemDto[]> {
    return this.consultationsService.listMine(
      user,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @ApiOperation({ summary: 'Get the AI-generated whole-call summary' })
  @Get('consultations/:id/summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsultationSummaryDto> {
    return this.consultationsService.getSummary(user, id);
  }

  @ApiOperation({ summary: 'Get one consultation' })
  @Get('consultations/:id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsultationDto> {
    return this.consultationsService.findOne(user, id);
  }

  @Roles('doctor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End an active consultation' })
  @Post('consultations/:id/end')
  end(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EndConsultationResponseDto> {
    return this.consultationsService.end(user, id);
  }
}
