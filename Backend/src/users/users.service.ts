import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DoctorSummaryDto, UserDto } from '@telemed/service-contracts';
import { AppointmentAccessService } from '../appointments/appointment-access.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListDoctorsQueryDto } from './dto/list-doctors-query.dto';
import type { UpdateUserRequestDto } from './dto/update-user-request.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AppointmentAccessService,
  ) {}

  async getMe(user: AuthenticatedUser): Promise<UserDto> {
    const found = await this.prisma.user.findFirst({
      where: { id: user.sub, deletedAt: null },
    });
    if (!found) {
      throw this.unauthenticated();
    }
    return toUserDto(found);
  }

  async updateMe(
    user: AuthenticatedUser,
    dto: UpdateUserRequestDto,
  ): Promise<UserDto> {
    const found = await this.prisma.user.findFirst({
      where: { id: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!found) {
      throw this.unauthenticated();
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.specialty !== undefined) {
      data.specialty = dto.specialty.trim();
    }

    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data,
    });
    return toUserDto(updated);
  }

  async listDoctors(query: ListDoctorsQueryDto): Promise<DoctorSummaryDto[]> {
    const doctors = await this.prisma.user.findMany({
      where: {
        role: 'doctor',
        deletedAt: null,
        ...(query.specialty
          ? {
              specialty: {
                equals: query.specialty.trim(),
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(query.q
          ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } }
          : {}),
      },
      select: { id: true, name: true, specialty: true, crm: true },
      orderBy: { name: 'asc' },
    });
    return doctors.map(toDoctorSummaryDto);
  }

  async getPatient(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<UserDto> {
    await this.accessService.assertNonCancelledPatientAccess(user, patientId);

    const patient = await this.prisma.user.findFirst({
      where: { id: patientId, role: 'patient', deletedAt: null },
    });
    if (!patient) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        message: 'Patient not found',
      });
    }
    return toUserDto(patient);
  }

  private unauthenticated(): UnauthorizedException {
    return new UnauthorizedException({
      errorCode: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
  }
}

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    specialty: user.specialty,
    crm: user.crm,
    createdAt: user.createdAt.toISOString(),
  };
}

function toDoctorSummaryDto(user: {
  id: string;
  name: string;
  specialty: string | null;
  crm: string | null;
}): DoctorSummaryDto {
  return {
    id: user.id,
    name: user.name,
    specialty: user.specialty,
    crm: user.crm,
  };
}
