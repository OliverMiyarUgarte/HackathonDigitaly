import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DoctorSummaryDto, UserDto } from '@telemed/service-contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ListDoctorsQueryDto } from './dto/list-doctors-query.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.usersService.getMe(user);
  }

  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<UserDto> {
    return this.usersService.updateMe(user, dto);
  }

  @ApiOperation({ summary: 'List doctors available for booking' })
  @Get('doctors')
  listDoctors(
    @Query() query: ListDoctorsQueryDto,
  ): Promise<DoctorSummaryDto[]> {
    return this.usersService.listDoctors(query);
  }

  @Roles('doctor')
  @ApiOperation({
    summary: 'Get a patient profile linked to the authenticated doctor',
  })
  @Get('patients/:patientId')
  getPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<UserDto> {
    return this.usersService.getPatient(user, patientId);
  }
}
