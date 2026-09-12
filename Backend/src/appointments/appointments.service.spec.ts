import { HttpException } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { Appointment, User } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AppointmentAccessService } from './appointment-access.service';
import { AppointmentsService } from './appointments.service';
import type { CreateAppointmentRequestDto } from './dto/create-appointment-request.dto';

const PATIENT: AuthenticatedUser = { sub: 'patient-1', role: 'patient' };
const DOCTOR: AuthenticatedUser = { sub: 'doctor-1', role: 'doctor' };

interface UserDelegateMock {
  findFirst: jest.Mock;
}

interface AppointmentDelegateMock {
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  updateMany: jest.Mock;
  findUnique: jest.Mock;
}

interface PreConsultAnswerDelegateMock {
  upsert: jest.Mock;
}

interface PrismaMock {
  $transaction: jest.Mock<
    Promise<unknown>,
    [(tx: PrismaMock) => Promise<unknown>]
  >;
  user: UserDelegateMock;
  appointment: AppointmentDelegateMock;
  preConsultAnswer: PreConsultAnswerDelegateMock;
}

interface AccessMock {
  assertAppointmentAccess: jest.Mock;
  assertPatientAccess: jest.Mock;
}

function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: PrismaMock) => Promise<unknown>]
    >(),
    user: { findFirst: jest.fn() },
    appointment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    preConsultAnswer: { upsert: jest.fn() },
  };
  mock.$transaction.mockImplementation((callback) => callback(mock));
  return mock;
}

function createAccessMock(): AccessMock {
  return {
    assertAppointmentAccess: jest.fn(),
    assertPatientAccess: jest.fn(),
  };
}

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-1',
    patientId: PATIENT.sub,
    doctorId: DOCTOR.sub,
    scheduledAt: new Date('2026-06-01T10:00:00.000Z'),
    status: 'pending_code',
    cancelReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: DOCTOR.sub,
    role: 'doctor',
    name: 'Dra. Helena Marques',
    email: 'medico@digitaly.health',
    passwordHash: 'hash',
    specialty: 'Cardiologia',
    crm: 'CRM-SP 123456',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function futureBusinessDate(daysAhead = 1, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date;
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

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaMock;
  let access: AccessMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    access = createAccessMock();
    service = new AppointmentsService(
      prisma as unknown as PrismaService,
      access as unknown as AppointmentAccessService,
    );
  });

  describe('create', () => {
    it('rejects a scheduledAt in the past with 400 VALIDATION_FAILED', async () => {
      const error = await expectHttpError(
        service.create(PATIENT, {
          doctorId: DOCTOR.sub,
          scheduledAt: new Date(Date.now() - 60_000).toISOString(),
        } satisfies CreateAppointmentRequestDto),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a scheduledAt outside business hours with 400 VALIDATION_FAILED', async () => {
      const error = await expectHttpError(
        service.create(PATIENT, {
          doctorId: DOCTOR.sub,
          scheduledAt: futureBusinessDate(1, 20).toISOString(),
        } satisfies CreateAppointmentRequestDto),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
      });
    });

    it('rejects an unknown doctor with 404 NOT_FOUND', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const error = await expectHttpError(
        service.create(PATIENT, {
          doctorId: DOCTOR.sub,
          scheduledAt: futureBusinessDate().toISOString(),
        } satisfies CreateAppointmentRequestDto),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ errorCode: 'NOT_FOUND' });
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    it('rejects an overlapping appointment with 409 SLOT_TAKEN', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: DOCTOR.sub });
      prisma.appointment.findFirst.mockResolvedValue({ id: 'existing' });

      const error = await expectHttpError(
        service.create(PATIENT, {
          doctorId: DOCTOR.sub,
          scheduledAt: futureBusinessDate().toISOString(),
        } satisfies CreateAppointmentRequestDto),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: 'SLOT_TAKEN' });
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    it('creates a pending_code appointment and upserts pre-consult answers', async () => {
      const scheduledAt = futureBusinessDate();
      prisma.user.findFirst.mockResolvedValue({ id: DOCTOR.sub });
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue(
        buildAppointment({ scheduledAt }),
      );
      prisma.preConsultAnswer.upsert.mockResolvedValue({ id: 'answer-1' });

      const result = await service.create(PATIENT, {
        doctorId: DOCTOR.sub,
        scheduledAt: scheduledAt.toISOString(),
        preConsult: [{ questionKey: 'chief_complaint', answer: 'Palpitacoes' }],
      } satisfies CreateAppointmentRequestDto);

      expect(result.status).toBe('pending_code');
      expect(result.patientId).toBe(PATIENT.sub);
      expect(prisma.appointment.create).toHaveBeenCalledWith({
        data: {
          patientId: PATIENT.sub,
          doctorId: DOCTOR.sub,
          scheduledAt,
          status: 'pending_code',
        },
      });
      expect(prisma.preConsultAnswer.upsert).toHaveBeenCalledWith({
        where: {
          appointmentId_questionKey: {
            appointmentId: 'appointment-1',
            questionKey: 'chief_complaint',
          },
        },
        update: { answer: 'Palpitacoes' },
        create: {
          appointmentId: 'appointment-1',
          questionKey: 'chief_complaint',
          answer: 'Palpitacoes',
        },
      });
    });
  });

  describe('cancel', () => {
    it('rejects a terminal appointment with 409 APPOINTMENT_TERMINAL', async () => {
      access.assertAppointmentAccess.mockResolvedValue(
        buildAppointment({ status: 'cancelled' }),
      );

      const error = await expectHttpError(
        service.cancel(PATIENT, 'appointment-1', {}),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'APPOINTMENT_TERMINAL',
      });
      expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    });

    it('returns 409 APPOINTMENT_TERMINAL when the status changed concurrently', async () => {
      access.assertAppointmentAccess.mockResolvedValue(
        buildAppointment({ status: 'confirmed' }),
      );
      prisma.appointment.updateMany.mockResolvedValue({ count: 0 });

      const error = await expectHttpError(
        service.cancel(PATIENT, 'appointment-1', {}),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'APPOINTMENT_TERMINAL',
      });
      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'appointment-1',
          status: 'confirmed',
          patientId: PATIENT.sub,
        },
        data: { status: 'cancelled', cancelReason: null },
      });
    });

    it('cancels the appointment with the optional reason', async () => {
      access.assertAppointmentAccess.mockResolvedValue(
        buildAppointment({ status: 'confirmed' }),
      );
      prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
      prisma.appointment.findUnique.mockResolvedValue(
        buildAppointment({ status: 'cancelled', cancelReason: 'Imprevisto' }),
      );

      const result = await service.cancel(PATIENT, 'appointment-1', {
        reason: 'Imprevisto',
      });

      expect(result.status).toBe('cancelled');
      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'appointment-1',
          status: 'confirmed',
          patientId: PATIENT.sub,
        },
        data: { status: 'cancelled', cancelReason: 'Imprevisto' },
      });
    });
  });

  describe('calendar', () => {
    it('marks confirmed appointments within the next 60 minutes as current', async () => {
      const withinWindow = new Date(Date.now() + 30 * 60 * 1000);
      const outsideWindow = new Date(Date.now() + 2 * 60 * 60 * 1000);
      prisma.appointment.findMany.mockResolvedValue([
        {
          ...buildAppointment({
            id: 'appointment-1',
            status: 'confirmed',
            scheduledAt: withinWindow,
          }),
          doctor: buildUser(),
          consultation: null,
        },
        {
          ...buildAppointment({
            id: 'appointment-2',
            status: 'confirmed',
            scheduledAt: outsideWindow,
          }),
          doctor: buildUser(),
          consultation: { id: 'consultation-1' },
        },
      ]);

      const entries = await service.calendar(PATIENT);

      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({
        appointmentId: 'appointment-1',
        isCurrent: true,
        consultationId: null,
      });
      expect(entries[0].counterpart).toMatchObject({
        id: DOCTOR.sub,
        role: 'doctor',
      });
      expect(entries[1]).toMatchObject({
        appointmentId: 'appointment-2',
        isCurrent: false,
        consultationId: 'consultation-1',
      });
    });
  });

  describe('doctorList', () => {
    it('reports whether the appointment has pre-consult answers', async () => {
      prisma.appointment.findMany.mockResolvedValue([
        {
          ...buildAppointment({ id: 'appointment-1' }),
          patient: buildUser({
            id: PATIENT.sub,
            role: 'patient',
            name: 'Joao Pereira',
            specialty: null,
            crm: null,
          }),
          consultation: { id: 'consultation-1' },
          preConsultAnswers: [{ id: 'answer-1' }],
        },
      ]);

      const appointments = await service.doctorList(DOCTOR);

      expect(appointments).toHaveLength(1);
      expect(appointments[0]).toMatchObject({
        appointmentId: 'appointment-1',
        patient: { id: PATIENT.sub, role: 'patient' },
        consultationId: 'consultation-1',
        hasPreConsult: true,
      });
    });
  });
});
