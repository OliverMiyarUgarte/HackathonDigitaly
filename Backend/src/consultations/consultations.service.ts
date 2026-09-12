import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ConsultationDto,
  ConsultationHistoryItemDto,
  CounterpartDto,
  EndConsultationResponseDto,
  StartConsultationResponseDto,
} from '@telemed/service-contracts';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type {
  Appointment,
  Consultation,
  User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type ConsultationHistoryRow = Consultation & {
  appointment: Appointment & { doctor: User };
  medicalRecord: { diagnosis: string | null } | null;
};

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async start(
    doctor: AuthenticatedUser,
    appointmentId: string,
  ): Promise<StartConsultationResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { consultation: { select: { id: true } } },
    });
    if (!appointment) {
      throw this.notFound('Appointment not found');
    }
    if (appointment.doctorId !== doctor.sub) {
      throw this.forbidden();
    }
    if (appointment.consultation) {
      throw this.consultationExists();
    }
    if (appointment.status !== 'confirmed') {
      throw this.appointmentNotConfirmed();
    }

    const startedAt = new Date();
    let consultationId: string;
    try {
      const consultation = await this.prisma.$transaction(async (tx) => {
        const created = await tx.consultation.create({
          data: { appointmentId, status: 'active', startedAt },
        });

        const updated = await tx.appointment.updateMany({
          where: { id: appointmentId, status: 'confirmed' },
          data: { status: 'in_progress' },
        });
        if (updated.count === 0) {
          throw this.appointmentNotConfirmed();
        }

        return created;
      });
      consultationId = consultation.id;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.consultationExists();
      }
      throw error;
    }

    this.realtime.emitToAppointment(appointmentId, 'consultation.started', {
      appointmentId,
      consultationId,
      doctorId: appointment.doctorId,
      startedAt: startedAt.toISOString(),
    });
    this.realtime.emitToUser(appointment.patientId, 'consultation.started', {
      appointmentId,
      consultationId,
      doctorId: appointment.doctorId,
      startedAt: startedAt.toISOString(),
    });

    return {
      consultationId,
      appointmentId,
      status: 'active',
      startedAt: startedAt.toISOString(),
      roomId: this.realtime.appointmentRoom(appointmentId),
      iceServers: this.realtime.buildIceServers(),
      participants: this.realtime.getParticipants(appointmentId),
    };
  }

  async end(
    doctor: AuthenticatedUser,
    consultationId: string,
  ): Promise<EndConsultationResponseDto> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { appointment: true },
    });
    if (!consultation) {
      throw this.notFound('Consultation not found');
    }
    if (consultation.appointment.doctorId !== doctor.sub) {
      throw this.forbidden();
    }
    if (consultation.status !== 'active') {
      throw this.consultationNotActive();
    }

    const endedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const ended = await tx.consultation.updateMany({
        where: { id: consultationId, status: 'active' },
        data: { status: 'ended', endedAt },
      });
      if (ended.count === 0) {
        throw this.consultationNotActive();
      }

      await tx.appointment.updateMany({
        where: { id: consultation.appointmentId, status: 'in_progress' },
        data: { status: 'completed' },
      });
    });

    this.realtime.emitToAppointment(
      consultation.appointmentId,
      'consultation.ended',
      {
        appointmentId: consultation.appointmentId,
        consultationId,
        endedAt: endedAt.toISOString(),
      },
    );

    return {
      consultationId,
      appointmentId: consultation.appointmentId,
      status: 'ended',
      startedAt: consultation.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    };
  }

  async findOne(
    user: AuthenticatedUser,
    consultationId: string,
  ): Promise<ConsultationDto> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        appointment: { select: { patientId: true, doctorId: true } },
      },
    });
    if (!consultation) {
      throw this.notFound('Consultation not found');
    }

    const isParticipant =
      consultation.appointment.patientId === user.sub ||
      consultation.appointment.doctorId === user.sub;
    if (!isParticipant) {
      throw this.forbidden();
    }

    return toConsultationDto(consultation);
  }

  async listMine(
    patient: AuthenticatedUser,
    from?: Date,
    to?: Date,
  ): Promise<ConsultationHistoryItemDto[]> {
    const consultations = await this.prisma.consultation.findMany({
      where: {
        appointment: { patientId: patient.sub },
        ...(from || to
          ? {
              startedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        appointment: { include: { doctor: true } },
        medicalRecord: { select: { diagnosis: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return consultations.map((consultation) =>
      toConsultationHistoryItem(consultation),
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ errorCode: 'NOT_FOUND', message });
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      errorCode: 'FORBIDDEN',
      message: 'Access denied',
    });
  }

  private appointmentNotConfirmed(): ConflictException {
    return new ConflictException({
      errorCode: 'APPOINTMENT_NOT_CONFIRMED',
      message: 'Appointment not confirmed',
    });
  }

  private consultationExists(): ConflictException {
    return new ConflictException({
      errorCode: 'CONSULTATION_EXISTS',
      message: 'Consultation already exists',
    });
  }

  private consultationNotActive(): ConflictException {
    return new ConflictException({
      errorCode: 'CONSULTATION_NOT_ACTIVE',
      message: 'Consultation is not active',
    });
  }
}

function toConsultationDto(consultation: Consultation): ConsultationDto {
  return {
    id: consultation.id,
    appointmentId: consultation.appointmentId,
    status: consultation.status,
    startedAt: consultation.startedAt.toISOString(),
    endedAt: consultation.endedAt ? consultation.endedAt.toISOString() : null,
  };
}

function toConsultationHistoryItem(
  consultation: ConsultationHistoryRow,
): ConsultationHistoryItemDto {
  return {
    consultationId: consultation.id,
    appointmentId: consultation.appointmentId,
    startedAt: consultation.startedAt.toISOString(),
    endedAt: consultation.endedAt ? consultation.endedAt.toISOString() : null,
    doctor: toCounterpart(consultation.appointment.doctor),
    diagnosis: consultation.medicalRecord?.diagnosis ?? null,
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
