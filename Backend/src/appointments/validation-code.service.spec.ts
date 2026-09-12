import { HttpException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { AuditService } from '../common/audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { Appointment, ValidationCode } from '../generated/prisma/client';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppointmentAccessService } from './appointment-access.service';
import { ValidationCodeService } from './validation-code.service';

const PEPPER = 'unit-test-pepper';
const PATIENT: AuthenticatedUser = { sub: 'patient-1', role: 'patient' };

function expectedHash(appointmentId: string, code: string): string {
  return createHmac('sha256', PEPPER)
    .update(`${appointmentId}:${code}`)
    .digest('hex');
}

interface ValidationCodeDelegateMock {
  findFirst: jest.Mock<Promise<ValidationCode | null>, [unknown]>;
  create: jest.Mock<Promise<ValidationCode>, [ValidationCodeCreateCall]>;
  update: jest.Mock<Promise<ValidationCode>, [unknown]>;
  updateMany: jest.Mock<Promise<{ count: number }>, [unknown]>;
  aggregate: jest.Mock<
    Promise<{ _sum: { attempts: number | null } }>,
    [unknown]
  >;
}

interface AppointmentDelegateMock {
  findUnique: jest.Mock<Promise<Appointment | null>, [unknown]>;
  updateMany: jest.Mock<Promise<{ count: number }>, [unknown]>;
}

interface UserDelegateMock {
  findUnique: jest.Mock<Promise<{ email: string } | null>, [unknown]>;
}

interface AuditLogDelegateMock {
  create: jest.Mock<Promise<{ id: string }>, [unknown]>;
}

interface PrismaMock {
  $transaction: jest.Mock<
    Promise<unknown>,
    [(tx: PrismaMock) => Promise<unknown>]
  >;
  validationCode: ValidationCodeDelegateMock;
  appointment: AppointmentDelegateMock;
  user: UserDelegateMock;
  auditLog: AuditLogDelegateMock;
}

interface AccessMock {
  assertAppointmentAccess: jest.Mock<
    Promise<Appointment>,
    [AuthenticatedUser, string]
  >;
  assertPatientAccess: jest.Mock<Promise<void>, [AuthenticatedUser, string]>;
}

interface MailMock {
  sendValidationCode: jest.Mock<Promise<void>, [string, string, number]>;
}

interface ConfigMock {
  getOrThrow: jest.Mock<string, [string]>;
  get: jest.Mock<number, [string, number]>;
}

interface AuditMock {
  record: jest.Mock<Promise<void>, [unknown]>;
}

function createAuditMock(): AuditMock {
  return {
    record: jest.fn<Promise<void>, [unknown]>(() => Promise.resolve()),
  };
}

interface ValidationCodeCreateCall {
  data: {
    appointmentId: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
  };
}

function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: PrismaMock) => Promise<unknown>]
    >(),
    validationCode: {
      findFirst: jest.fn<Promise<ValidationCode | null>, [unknown]>(),
      create: jest.fn<Promise<ValidationCode>, [ValidationCodeCreateCall]>(),
      update: jest.fn<Promise<ValidationCode>, [unknown]>(),
      updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
      aggregate: jest.fn<
        Promise<{ _sum: { attempts: number | null } }>,
        [unknown]
      >(),
    },
    appointment: {
      findUnique: jest.fn<Promise<Appointment | null>, [unknown]>(),
      updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
    },
    user: {
      findUnique: jest.fn<Promise<{ email: string } | null>, [unknown]>(),
    },
    auditLog: { create: jest.fn<Promise<{ id: string }>, [unknown]>() },
  };
  mock.$transaction.mockImplementation((callback) => callback(mock));
  return mock;
}

function createAccessMock(): AccessMock {
  return {
    assertAppointmentAccess: jest.fn<
      Promise<Appointment>,
      [AuthenticatedUser, string]
    >(),
    assertPatientAccess: jest.fn<Promise<void>, [AuthenticatedUser, string]>(),
  };
}

function createMailMock(): MailMock {
  return {
    sendValidationCode: jest.fn<Promise<void>, [string, string, number]>(() =>
      Promise.resolve(),
    ),
  };
}

function createConfigMock(): ConfigMock {
  return {
    getOrThrow: jest.fn<string, [string]>(() => PEPPER),
    get: jest.fn<number, [string, number]>((_key, fallback) => fallback),
  };
}

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-1',
    patientId: PATIENT.sub,
    doctorId: 'doctor-1',
    scheduledAt: new Date('2026-06-01T10:00:00.000Z'),
    status: 'pending_code',
    cancelReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildValidationCode(
  overrides: Partial<ValidationCode> = {},
): ValidationCode {
  return {
    id: 'code-1',
    appointmentId: 'appointment-1',
    codeHash: expectedHash('appointment-1', '123456'),
    expiresAt: new Date(Date.now() + 600_000),
    consumedAt: null,
    attempts: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

async function expectHttpError(
  promise: Promise<unknown>,
): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected request to fail');
}

describe('ValidationCodeService', () => {
  let service: ValidationCodeService;
  let prisma: PrismaMock;
  let access: AccessMock;
  let mail: MailMock;
  let config: ConfigMock;
  let audit: AuditMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    access = createAccessMock();
    mail = createMailMock();
    config = createConfigMock();
    audit = createAuditMock();
    service = new ValidationCodeService(
      prisma as unknown as PrismaService,
      access as unknown as AppointmentAccessService,
      mail as unknown as MailService,
      config as unknown as ConfigService,
      audit as unknown as AuditService,
    );
  });

  function mockIssueAppointment(): void {
    access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
    prisma.user.findUnique.mockResolvedValue({ email: 'patient@example.test' });
    prisma.validationCode.create.mockImplementation(
      (args: ValidationCodeCreateCall) =>
        Promise.resolve({
          id: 'code-1',
          appointmentId: args.data.appointmentId,
          codeHash: args.data.codeHash,
          expiresAt: args.data.expiresAt,
          consumedAt: null,
          attempts: args.data.attempts,
          createdAt: new Date(),
        }),
    );
  }

  async function issueCode(): Promise<string> {
    mockIssueAppointment();
    await service.request(PATIENT, 'appointment-1');
    return mail.sendValidationCode.mock.calls[0][1];
  }

  describe('request', () => {
    it('issues a code and stores only a peppered HMAC hash', async () => {
      mockIssueAppointment();

      const result = await service.request(PATIENT, 'appointment-1');

      expect(result.appointmentId).toBe('appointment-1');
      expect(result.attemptsRemaining).toBe(5);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const sentCode = mail.sendValidationCode.mock.calls[0][1];
      expect(sentCode).toMatch(/^\d{6}$/);

      const createCall = prisma.validationCode.create.mock.calls[0][0];
      expect(createCall.data.attempts).toBe(0);
      expect(createCall.data.codeHash).not.toBe(sentCode);
      expect(createCall.data.codeHash).toBe(
        expectedHash('appointment-1', sentCode),
      );
    });

    it('binds the hash to the appointment id', () => {
      const sameCode = '123456';
      expect(expectedHash('appointment-1', sameCode)).not.toBe(
        expectedHash('appointment-2', sameCode),
      );
    });

    it('rejects a non pending_code appointment with 409 CONFLICT', async () => {
      access.assertAppointmentAccess.mockResolvedValue(
        buildAppointment({ status: 'confirmed' }),
      );

      const error = await expectHttpError(
        service.request(PATIENT, 'appointment-1'),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: 'CONFLICT' });
      expect(prisma.validationCode.create).not.toHaveBeenCalled();
      expect(mail.sendValidationCode).not.toHaveBeenCalled();
    });
  });

  describe('resend', () => {
    it('invalidates the previous code and resets attempts', async () => {
      mockIssueAppointment();

      await service.request(PATIENT, 'appointment-1');
      await service.resend(PATIENT, 'appointment-1');

      expect(prisma.validationCode.updateMany).toHaveBeenCalledWith({
        where: { appointmentId: 'appointment-1', consumedAt: null },
        data: { consumedAt: expect.any(Date) as Date },
      });
      expect(prisma.validationCode.create).toHaveBeenCalledTimes(2);
      const secondCall = prisma.validationCode.create.mock.calls[1][0];
      expect(secondCall.data.attempts).toBe(0);
      expect(mail.sendValidationCode).toHaveBeenCalledTimes(2);
    });
  });

  describe('verify', () => {
    it('confirms the appointment with the correct code and writes audit entries', async () => {
      const code = await issueCode();
      access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
      prisma.validationCode.findFirst.mockResolvedValue(
        buildValidationCode({ codeHash: expectedHash('appointment-1', code) }),
      );
      prisma.validationCode.aggregate.mockResolvedValue({
        _sum: { attempts: 0 },
      });
      prisma.validationCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
      prisma.appointment.findUnique.mockResolvedValue(
        buildAppointment({ status: 'confirmed' }),
      );

      const result = await service.verify(PATIENT, 'appointment-1', { code });

      expect(result.status).toBe('confirmed');
      expect(prisma.validationCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'code-1', consumedAt: null },
        data: { consumedAt: expect.any(Date) as Date },
      });
      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appointment-1', status: 'pending_code' },
        data: { status: 'confirmed' },
      });
      expect(audit.record).toHaveBeenCalledWith({
        actorId: PATIENT.sub,
        action: 'appointment.confirm',
        resourceType: 'appointment',
        resourceId: 'appointment-1',
        outcome: 'success',
      });
      expect(audit.record).toHaveBeenCalledWith({
        actorId: PATIENT.sub,
        action: 'appointment.code.verify',
        resourceType: 'appointment',
        resourceId: 'appointment-1',
        outcome: 'success',
      });
      expect(JSON.stringify(audit.record.mock.calls)).not.toContain(code);
    });

    it('rejects a wrong code, increments attempts, and keeps the appointment pending', async () => {
      access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
      prisma.validationCode.findFirst.mockResolvedValue(
        buildValidationCode({
          codeHash: expectedHash('appointment-1', '111111'),
        }),
      );
      prisma.validationCode.aggregate.mockResolvedValue({
        _sum: { attempts: 0 },
      });

      const error = await expectHttpError(
        service.verify(PATIENT, 'appointment-1', { code: '222222' }),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_OR_EXPIRED_CODE',
      });
      expect(prisma.validationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an expired code without touching attempts', async () => {
      access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
      prisma.validationCode.findFirst.mockResolvedValue(
        buildValidationCode({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      const error = await expectHttpError(
        service.verify(PATIENT, 'appointment-1', { code: '123456' }),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_OR_EXPIRED_CODE',
      });
      expect(prisma.validationCode.update).not.toHaveBeenCalled();
    });

    it('rejects a consumed code', async () => {
      access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
      prisma.validationCode.findFirst.mockResolvedValue(
        buildValidationCode({ consumedAt: new Date() }),
      );

      const error = await expectHttpError(
        service.verify(PATIENT, 'appointment-1', { code: '123456' }),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_OR_EXPIRED_CODE',
      });
      expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    });

    it('rejects when the cumulative attempts cap is reached with 429 TOO_MANY_ATTEMPTS', async () => {
      access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
      prisma.validationCode.findFirst.mockResolvedValue(
        buildValidationCode({
          codeHash: expectedHash('appointment-1', '123456'),
        }),
      );
      prisma.validationCode.aggregate.mockResolvedValue({
        _sum: { attempts: 5 },
      });

      const error = await expectHttpError(
        service.verify(PATIENT, 'appointment-1', { code: '123456' }),
      );

      expect(error.getStatus()).toBe(429);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'TOO_MANY_ATTEMPTS',
      });
      expect(prisma.validationCode.update).not.toHaveBeenCalled();
      expect(prisma.validationCode.aggregate).toHaveBeenCalledWith({
        where: { appointmentId: 'appointment-1' },
        _sum: { attempts: true },
      });
    });

    it('never logs the code and never stores it in plaintext', async () => {
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const debugSpy = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);
      const verboseSpy = jest
        .spyOn(Logger.prototype, 'verbose')
        .mockImplementation(() => undefined);

      const code = await issueCode();

      const createCall = prisma.validationCode.create.mock.calls[0][0];
      expect(createCall.data.codeHash).not.toBe(code);

      const logged = JSON.stringify([
        ...logSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...debugSpy.mock.calls,
        ...verboseSpy.mock.calls,
      ]);
      expect(logged).not.toContain(code);

      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      debugSpy.mockRestore();
      verboseSpy.mockRestore();
    });
  });
});
