import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AppointmentDto,
  AppointmentStatus,
  CalendarEntryDto,
  CounterpartDto,
  DoctorAppointmentDto,
} from '@telemed/service-contracts';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  Prisma,
  type Appointment,
  type User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentAccessService } from './appointment-access.service';
import type { CancelAppointmentRequestDto } from './dto/cancel-appointment-request.dto';
import type { CreateAppointmentRequestDto } from './dto/create-appointment-request.dto';

const SLOT_MINUTES = 30;
const APPOINTMENT_MS = SLOT_MINUTES * 60 * 1000;
const BUSINESS_START_MINUTES = 9 * 60;
const BUSINESS_END_MINUTES = 17 * 60;
const CURRENT_WINDOW_MS = 60 * 60 * 1000;

type AppointmentWithDoctor = Appointment & {
  doctor: User;
  consultation: { id: string } | null;
};

type AppointmentWithPatient = Appointment & {
  patient: User;
  consultation: { id: string } | null;
  preConsultAnswers: { id: string }[];
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AppointmentAccessService,
  ) {}

  async create(
    patient: AuthenticatedUser,
    dto: CreateAppointmentRequestDto,
  ): Promise<AppointmentDto> {
    const scheduledAt = new Date(dto.scheduledAt);
    this.assertBookable(scheduledAt);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const doctor = await tx.user.findFirst({
          where: { id: dto.doctorId, role: 'doctor', deletedAt: null },
          select: { id: true },
        });
        if (!doctor) {
          throw new NotFoundException({
            errorCode: 'NOT_FOUND',
            message: 'Doctor not found',
          });
        }

        const lockKey = `${dto.doctorId}:${scheduledAt.toISOString()}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const windowStart = new Date(scheduledAt.getTime() - APPOINTMENT_MS);
        const windowEnd = new Date(scheduledAt.getTime() + APPOINTMENT_MS);
        const conflict = await tx.appointment.findFirst({
          where: {
            status: { not: 'cancelled' },
            OR: [
              {
                doctorId: dto.doctorId,
                scheduledAt: { gt: windowStart, lt: windowEnd },
              },
              {
                patientId: patient.sub,
                scheduledAt: { gt: windowStart, lt: windowEnd },
              },
            ],
          },
          select: { id: true },
        });
        if (conflict) {
          throw this.slotTaken();
        }

        const created = await tx.appointment.create({
          data: {
            patientId: patient.sub,
            doctorId: dto.doctorId,
            scheduledAt,
            status: 'pending_code',
          },
        });

        for (const answer of dto.preConsult ?? []) {
          await tx.preConsultAnswer.upsert({
            where: {
              appointmentId_questionKey: {
                appointmentId: created.id,
                questionKey: answer.questionKey,
              },
            },
            update: { answer: answer.answer },
            create: {
              appointmentId: created.id,
              questionKey: answer.questionKey,
              answer: answer.answer,
            },
          });
        }

        return toAppointmentDto(created);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw this.slotTaken();
      }
      throw error;
    }
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<AppointmentDto> {
    const appointment = await this.accessService.assertAppointmentAccess(
      user,
      id,
    );
    return toAppointmentDto(appointment);
  }

  async calendar(
    patient: AuthenticatedUser,
    from?: Date,
    to?: Date,
  ): Promise<CalendarEntryDto[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId: patient.sub,
        ...(from || to
          ? {
              scheduledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: { doctor: true, consultation: { select: { id: true } } },
      orderBy: { scheduledAt: 'asc' },
    });

    const now = Date.now();
    return appointments.map((appointment) => toCalendarEntry(appointment, now));
  }

  async doctorList(
    doctor: AuthenticatedUser,
    date?: Date,
    status?: AppointmentStatus,
  ): Promise<DoctorAppointmentDto[]> {
    const dayRange = date ? localDayRange(date) : null;
    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctor.sub,
        ...(status ? { status } : {}),
        ...(dayRange
          ? { scheduledAt: { gte: dayRange.start, lt: dayRange.end } }
          : {}),
      },
      include: {
        patient: true,
        consultation: { select: { id: true } },
        preConsultAnswers: { select: { id: true }, take: 1 },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return appointments.map((appointment) => toDoctorAppointment(appointment));
  }

  async cancel(
    user: AuthenticatedUser,
    id: string,
    dto: CancelAppointmentRequestDto | undefined,
  ): Promise<AppointmentDto> {
    const appointment = await this.accessService.assertAppointmentAccess(
      user,
      id,
    );
    if (isTerminal(appointment.status)) {
      throw this.terminal();
    }

    const scope =
      user.role === 'patient'
        ? { patientId: user.sub }
        : { doctorId: user.sub };
    const result = await this.prisma.appointment.updateMany({
      where: { id, status: appointment.status, ...scope },
      data: {
        status: 'cancelled',
        cancelReason: dto?.reason?.trim() || null,
      },
    });
    if (result.count === 0) {
      throw this.terminal();
    }

    const updated = await this.prisma.appointment.findUnique({ where: { id } });
    if (!updated) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        message: 'Appointment not found',
      });
    }
    return toAppointmentDto(updated);
  }

  private assertBookable(scheduledAt: Date): void {
    if (
      Number.isNaN(scheduledAt.getTime()) ||
      scheduledAt.getTime() <= Date.now()
    ) {
      throw this.validationError('scheduledAt must be in the future');
    }
    const weekday = scheduledAt.getDay();
    if (weekday === 0 || weekday === 6) {
      throw this.validationError('scheduledAt must be a weekday');
    }
    const minutes = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
    if (
      minutes < BUSINESS_START_MINUTES ||
      minutes + SLOT_MINUTES > BUSINESS_END_MINUTES
    ) {
      throw this.validationError(
        'scheduledAt must be within business hours (09:00-17:00)',
      );
    }
    if (
      scheduledAt.getMinutes() % SLOT_MINUTES !== 0 ||
      scheduledAt.getSeconds() !== 0 ||
      scheduledAt.getMilliseconds() !== 0
    ) {
      throw this.validationError('scheduledAt must align to a 30-minute slot');
    }
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({
      errorCode: 'VALIDATION_FAILED',
      message,
    });
  }

  private slotTaken(): ConflictException {
    return new ConflictException({
      errorCode: 'SLOT_TAKEN',
      message: 'Slot already taken',
    });
  }

  private terminal(): ConflictException {
    return new ConflictException({
      errorCode: 'APPOINTMENT_TERMINAL',
      message: 'Appointment is in a terminal state',
    });
  }
}

export function toAppointmentDto(appointment: Appointment): AppointmentDto {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

function toCalendarEntry(
  appointment: AppointmentWithDoctor,
  now: number,
): CalendarEntryDto {
  return {
    appointmentId: appointment.id,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    counterpart: toCounterpart(appointment.doctor),
    consultationId: appointment.consultation?.id ?? null,
    isCurrent: isCurrent(appointment, now),
  };
}

function toDoctorAppointment(
  appointment: AppointmentWithPatient,
): DoctorAppointmentDto {
  return {
    appointmentId: appointment.id,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    patient: toCounterpart(appointment.patient),
    consultationId: appointment.consultation?.id ?? null,
    hasPreConsult: appointment.preConsultAnswers.length > 0,
  };
}

function toCounterpart(user: User): CounterpartDto {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    specialty: user.specialty,
  };
}

function isCurrent(appointment: Appointment, now: number): boolean {
  if (appointment.status === 'in_progress') {
    return true;
  }
  if (appointment.status !== 'confirmed') {
    return false;
  }
  const scheduledAt = appointment.scheduledAt.getTime();
  return scheduledAt >= now && scheduledAt <= now + CURRENT_WINDOW_MS;
}

function isTerminal(status: AppointmentStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function localDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { start, end };
}
