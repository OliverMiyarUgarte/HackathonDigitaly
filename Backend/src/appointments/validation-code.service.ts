import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppointmentDto,
  RequestCodeResponseDto,
} from '@telemed/service-contracts';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentAccessService } from './appointment-access.service';
import { toAppointmentDto } from './appointments.service';
import type { VerifyCodeRequestDto } from './dto/verify-code-request.dto';

const DEFAULT_TTL_SECONDS = 600;
const DEFAULT_MAX_ATTEMPTS = 5;
const CODE_MODULUS = 1_000_000;
const CODE_LENGTH = 6;

@Injectable()
export class ValidationCodeService {
  private readonly pepper: string;
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AppointmentAccessService,
    private readonly mailService: MailService,
    configService: ConfigService,
  ) {
    this.pepper = configService.getOrThrow<string>('OTP_PEPPER');
    this.ttlSeconds = configService.get<number>(
      'OTP_TTL_SECONDS',
      DEFAULT_TTL_SECONDS,
    );
    this.maxAttempts = configService.get<number>(
      'OTP_MAX_ATTEMPTS',
      DEFAULT_MAX_ATTEMPTS,
    );
  }

  request(
    patient: AuthenticatedUser,
    appointmentId: string,
  ): Promise<RequestCodeResponseDto> {
    return this.issue(patient, appointmentId);
  }

  resend(
    patient: AuthenticatedUser,
    appointmentId: string,
  ): Promise<RequestCodeResponseDto> {
    return this.issue(patient, appointmentId);
  }

  async verify(
    patient: AuthenticatedUser,
    appointmentId: string,
    dto: VerifyCodeRequestDto,
  ): Promise<AppointmentDto> {
    const appointment = await this.accessService.assertAppointmentAccess(
      patient,
      appointmentId,
    );
    if (appointment.status !== 'pending_code') {
      throw this.conflict();
    }

    const code = await this.prisma.validationCode.findFirst({
      where: { appointmentId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!code || code.consumedAt || code.expiresAt.getTime() <= Date.now()) {
      throw this.invalidCode();
    }

    const attempts = await this.prisma.validationCode.aggregate({
      where: { appointmentId },
      _sum: { attempts: true },
    });
    if ((attempts._sum.attempts ?? 0) >= this.maxAttempts) {
      throw this.tooManyAttempts();
    }

    const candidateHash = this.hashCode(appointmentId, dto.code);
    if (!this.hashesMatch(code.codeHash, candidateHash)) {
      await this.prisma.validationCode.update({
        where: { id: code.id },
        data: { attempts: { increment: 1 } },
      });
      throw this.invalidCode();
    }

    return this.confirm(patient, appointmentId, code.id);
  }

  private async issue(
    patient: AuthenticatedUser,
    appointmentId: string,
  ): Promise<RequestCodeResponseDto> {
    const appointment = await this.accessService.assertAppointmentAccess(
      patient,
      appointmentId,
    );
    if (appointment.status !== 'pending_code') {
      throw this.conflict();
    }

    const patientUser = await this.prisma.user.findUnique({
      where: { id: appointment.patientId },
      select: { email: true },
    });
    if (!patientUser) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        message: 'Patient not found',
      });
    }

    const code = this.generateCode();
    const codeHash = this.hashCode(appointmentId, code);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.validationCode.updateMany({
        where: { appointmentId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.validationCode.create({
        data: {
          appointmentId,
          codeHash,
          expiresAt,
          attempts: 0,
        },
      });
    });

    await this.mailService.sendValidationCode(
      patientUser.email,
      code,
      Math.max(1, Math.ceil(this.ttlSeconds / 60)),
    );

    return {
      appointmentId,
      expiresAt: expiresAt.toISOString(),
      attemptsRemaining: this.maxAttempts,
    };
  }

  private async confirm(
    patient: AuthenticatedUser,
    appointmentId: string,
    codeId: string,
  ): Promise<AppointmentDto> {
    const appointment = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.validationCode.updateMany({
        where: { id: codeId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count === 0) {
        throw this.invalidCode();
      }

      const updated = await tx.appointment.updateMany({
        where: { id: appointmentId, status: 'pending_code' },
        data: { status: 'confirmed' },
      });
      if (updated.count === 0) {
        throw this.conflict();
      }

      await tx.auditLog.create({
        data: {
          actorId: patient.sub,
          action: 'appointment.confirmed',
          resourceType: 'appointment',
          resourceId: appointmentId,
        },
      });

      const confirmed = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      if (!confirmed) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }
      return confirmed;
    });

    return toAppointmentDto(appointment);
  }

  private generateCode(): string {
    return randomInt(0, CODE_MODULUS).toString().padStart(CODE_LENGTH, '0');
  }

  private hashCode(appointmentId: string, code: string): string {
    return createHmac('sha256', this.pepper)
      .update(`${appointmentId}:${code}`)
      .digest('hex');
  }

  private hashesMatch(storedHash: string, candidateHash: string): boolean {
    const stored = Buffer.from(storedHash, 'utf8');
    const candidate = Buffer.from(candidateHash, 'utf8');
    if (stored.length !== candidate.length) {
      return false;
    }
    return timingSafeEqual(stored, candidate);
  }

  private invalidCode(): BadRequestException {
    return new BadRequestException({
      errorCode: 'INVALID_OR_EXPIRED_CODE',
      message: 'Invalid or expired code',
    });
  }

  private tooManyAttempts(): HttpException {
    return new HttpException(
      {
        errorCode: 'TOO_MANY_ATTEMPTS',
        message: 'Too many attempts',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private conflict(): ConflictException {
    return new ConflictException({
      errorCode: 'CONFLICT',
      message: 'Appointment is not pending confirmation',
    });
  }
}
