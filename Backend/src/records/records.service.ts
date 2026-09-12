import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PRE_CONSULT_QUESTION_KEYS,
  type ConsultationHistoryItemDto,
  type CounterpartDto,
  type MedicalRecordDto,
  type MedicalRecordSummaryDto,
  type PatientOverviewDto,
  type PreConsultAnswerDto,
  type PreConsultQuestionKey,
  type UserDto,
} from '@telemed/service-contracts';
import { AuditService } from '../common/audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type {
  MedicalRecord,
  PreConsultAnswer,
  User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentAccessService } from '../appointments/appointment-access.service';
import { toAppointmentDto } from '../appointments/appointments.service';
import type { CreateMedicalRecordRequestDto } from './dto/create-medical-record-request.dto';
import type { HistoryQueryDto } from './dto/history-query.dto';
import type { PreConsultAnswerInputDto } from './dto/pre-consult-answer-input.dto';

const RECENT_RECORDS_LIMIT = 10;
const EDITABLE_STATUSES = new Set<string>(['pending_code', 'confirmed']);

type ConsultationHistoryRow = {
  id: string;
  appointmentId: string;
  startedAt: Date;
  endedAt: Date | null;
  appointment: { doctor: User };
  medicalRecord: { diagnosis: string | null } | null;
};

type MedicalRecordRow = {
  id: string;
  consultationId: string;
  createdAt: Date;
  diagnosis: string | null;
};

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AppointmentAccessService,
    private readonly auditService: AuditService,
  ) {}

  async getPreConsult(
    user: AuthenticatedUser,
    appointmentId: string,
  ): Promise<PreConsultAnswerDto[]> {
    await this.accessService.assertAppointmentAccess(user, appointmentId);
    const answers = await this.prisma.preConsultAnswer.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'asc' },
    });
    return answers.map(toPreConsultAnswerDto);
  }

  async putPreConsult(
    patient: AuthenticatedUser,
    appointmentId: string,
    answers: PreConsultAnswerInputDto[],
  ): Promise<PreConsultAnswerDto[]> {
    const appointment = await this.accessService.assertAppointmentAccess(
      patient,
      appointmentId,
    );
    if (!EDITABLE_STATUSES.has(appointment.status)) {
      throw this.conflict(
        'Pre-consult answers are closed for this appointment',
      );
    }

    const normalized = this.normalizeAnswers(answers);

    return this.prisma.$transaction(async (tx) => {
      for (const answer of normalized) {
        await tx.preConsultAnswer.upsert({
          where: {
            appointmentId_questionKey: {
              appointmentId,
              questionKey: answer.questionKey,
            },
          },
          update: { answer: answer.answer },
          create: {
            appointmentId,
            questionKey: answer.questionKey,
            answer: answer.answer,
          },
        });
      }

      const saved = await tx.preConsultAnswer.findMany({
        where: { appointmentId },
        orderBy: { createdAt: 'asc' },
      });
      return saved.map(toPreConsultAnswerDto);
    });
  }

  async getPatientOverview(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<PatientOverviewDto> {
    if (user.role === 'doctor') {
      await this.accessService.assertPatientAccess(user, patientId);
    } else if (user.sub !== patientId) {
      throw this.forbidden();
    }

    const patient = await this.prisma.user.findFirst({
      where: { id: patientId, role: 'patient', deletedAt: null },
    });
    if (!patient) {
      throw this.notFound('Patient not found');
    }

    const now = new Date();
    const upcomingAppointment = await this.prisma.appointment.findFirst({
      where: {
        patientId,
        OR: [
          {
            status: { in: ['pending_code', 'confirmed'] },
            scheduledAt: { gte: now },
          },
          { status: 'in_progress' },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const records = await this.prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS_LIMIT,
    });

    const preConsult = upcomingAppointment
      ? await this.prisma.preConsultAnswer.findMany({
          where: { appointmentId: upcomingAppointment.id },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    await this.auditService.record({
      actorId: user.sub,
      action: 'patient.overview.read',
      resourceType: 'patient',
      resourceId: patientId,
      outcome: 'success',
    });

    return {
      patient: toUserDto(patient),
      upcomingAppointment: upcomingAppointment
        ? toAppointmentDto(upcomingAppointment)
        : null,
      history: records.map(toMedicalRecordSummaryDto),
      preConsult: preConsult.map(toPreConsultAnswerDto),
    };
  }

  async getHistory(
    user: AuthenticatedUser,
    query: HistoryQueryDto,
  ): Promise<ConsultationHistoryItemDto[]> {
    let patientId: string | undefined;
    if (user.role === 'patient') {
      if (query.patientId && query.patientId !== user.sub) {
        throw this.forbidden();
      }
      patientId = user.sub;
    } else if (query.patientId) {
      await this.accessService.assertPatientAccess(user, query.patientId);
      patientId = query.patientId;
    }

    const consultations = await this.prisma.consultation.findMany({
      where: {
        appointment:
          patientId !== undefined ? { patientId } : { doctorId: user.sub },
        ...(query.from || query.to
          ? {
              startedAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
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

    await this.auditService.record({
      actorId: user.sub,
      action: 'consultation.history.read',
      resourceType: 'consultation_history',
      resourceId: patientId ?? user.sub,
      outcome: 'success',
    });

    return consultations.map(toConsultationHistoryItem);
  }

  async create(
    doctor: AuthenticatedUser,
    dto: CreateMedicalRecordRequestDto,
  ): Promise<MedicalRecordDto> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: dto.consultationId },
      include: { appointment: { select: { doctorId: true, patientId: true } } },
    });
    if (!consultation) {
      throw this.notFound('Consultation not found');
    }
    if (
      consultation.appointment.doctorId !== doctor.sub ||
      consultation.appointment.patientId !== dto.patientId
    ) {
      throw this.forbidden();
    }

    const existing = await this.prisma.medicalRecord.findUnique({
      where: { consultationId: dto.consultationId },
      select: { id: true },
    });
    if (existing) {
      throw this.recordExists();
    }

    try {
      const record = await this.prisma.medicalRecord.create({
        data: {
          patientId: dto.patientId,
          consultationId: dto.consultationId,
          createdBy: doctor.sub,
          notes: dto.notes,
          diagnosis: dto.diagnosis?.trim() || null,
          prescriptions: dto.prescriptions ?? [],
        },
      });
      await this.auditService.record({
        actorId: doctor.sub,
        action: 'medical_record.create',
        resourceType: 'medical_record',
        resourceId: record.id,
        outcome: 'success',
      });
      return toMedicalRecordDto(record);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw this.recordExists();
      }
      throw error;
    }
  }

  async findOne(
    user: AuthenticatedUser,
    recordId: string,
  ): Promise<MedicalRecordDto> {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
    });
    if (!record) {
      throw this.notFound('Medical record not found');
    }

    if (user.role === 'patient') {
      if (record.patientId !== user.sub) {
        throw this.forbidden();
      }
    } else {
      await this.accessService.assertPatientAccess(user, record.patientId);
    }

    await this.auditService.record({
      actorId: user.sub,
      action: 'medical_record.read',
      resourceType: 'medical_record',
      resourceId: record.id,
      outcome: 'success',
    });

    return toMedicalRecordDto(record);
  }

  private normalizeAnswers(
    answers: PreConsultAnswerInputDto[],
  ): PreConsultAnswerInputDto[] {
    const byKey = new Map<PreConsultQuestionKey, PreConsultAnswerInputDto>();
    for (const answer of answers) {
      if (!isQuestionKey(answer.questionKey)) {
        throw this.validationError(
          `Unknown questionKey: ${String(answer.questionKey)}`,
        );
      }
      byKey.set(answer.questionKey, {
        questionKey: answer.questionKey,
        answer: answer.answer,
      });
    }
    return [...byKey.values()];
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({
      errorCode: 'VALIDATION_FAILED',
      message,
    });
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      errorCode: 'FORBIDDEN',
      message: 'Access denied',
    });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ errorCode: 'NOT_FOUND', message });
  }

  private conflict(message: string): ConflictException {
    return new ConflictException({ errorCode: 'CONFLICT', message });
  }

  private recordExists(): ConflictException {
    return new ConflictException({
      errorCode: 'RECORD_EXISTS',
      message: 'Record already exists',
    });
  }
}

function isQuestionKey(value: string): value is PreConsultQuestionKey {
  return (PRE_CONSULT_QUESTION_KEYS as readonly string[]).includes(value);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
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

function toPreConsultAnswerDto(answer: PreConsultAnswer): PreConsultAnswerDto {
  return {
    id: answer.id,
    appointmentId: answer.appointmentId,
    questionKey: answer.questionKey,
    answer: answer.answer,
    createdAt: answer.createdAt.toISOString(),
  };
}

function toMedicalRecordDto(record: MedicalRecord): MedicalRecordDto {
  return {
    id: record.id,
    patientId: record.patientId,
    consultationId: record.consultationId,
    createdBy: record.createdBy,
    notes: record.notes,
    diagnosis: record.diagnosis,
    prescriptions: record.prescriptions,
    createdAt: record.createdAt.toISOString(),
  };
}

function toMedicalRecordSummaryDto(
  record: MedicalRecordRow,
): MedicalRecordSummaryDto {
  return {
    id: record.id,
    consultationId: record.consultationId,
    createdAt: record.createdAt.toISOString(),
    diagnosis: record.diagnosis,
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
