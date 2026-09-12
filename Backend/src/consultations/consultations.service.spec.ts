import { HttpException } from '@nestjs/common';
import type { AiProxyService } from '../ai/ai-proxy.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { Appointment, Consultation } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';
import { ConsultationsService } from './consultations.service';

const PATIENT: AuthenticatedUser = { sub: 'patient-1', role: 'patient' };
const DOCTOR: AuthenticatedUser = { sub: 'doctor-1', role: 'doctor' };

interface AppointmentDelegateMock {
  findUnique: jest.Mock;
  updateMany: jest.Mock;
}

interface ConsultationDelegateMock {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  updateMany: jest.Mock;
}

interface PrismaMock {
  $transaction: jest.Mock<
    Promise<unknown>,
    [(tx: PrismaMock) => Promise<unknown>]
  >;
  appointment: AppointmentDelegateMock;
  consultation: ConsultationDelegateMock;
}

interface RealtimeMock {
  emitToAppointment: jest.Mock;
  emitToUser: jest.Mock;
  buildIceServers: jest.Mock;
  getParticipants: jest.Mock;
  appointmentRoom: jest.Mock;
}

interface AiProxyMock {
  openSession: jest.Mock;
  closeSession: jest.Mock;
}

function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: PrismaMock) => Promise<unknown>]
    >(),
    appointment: { findUnique: jest.fn(), updateMany: jest.fn() },
    consultation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  mock.$transaction.mockImplementation((callback) => callback(mock));
  return mock;
}

function createRealtimeMock(): RealtimeMock {
  return {
    emitToAppointment: jest.fn(),
    emitToUser: jest.fn(),
    buildIceServers: jest.fn(),
    getParticipants: jest.fn(),
    appointmentRoom: jest.fn(),
  };
}

function createAiProxyMock(): AiProxyMock {
  return {
    openSession: jest.fn().mockResolvedValue(undefined),
    closeSession: jest.fn(),
  };
}

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-1',
    patientId: PATIENT.sub,
    doctorId: DOCTOR.sub,
    scheduledAt: new Date('2026-06-01T10:00:00.000Z'),
    status: 'confirmed',
    cancelReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildConsultation(
  overrides: Partial<Consultation> = {},
): Consultation {
  return {
    id: 'consultation-1',
    appointmentId: 'appointment-1',
    status: 'active',
    startedAt: new Date('2026-06-01T10:00:00.000Z'),
    endedAt: null,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:00:00.000Z'),
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

describe('ConsultationsService', () => {
  let service: ConsultationsService;
  let prisma: PrismaMock;
  let realtime: RealtimeMock;
  let aiProxy: AiProxyMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    realtime = createRealtimeMock();
    aiProxy = createAiProxyMock();
    realtime.appointmentRoom.mockImplementation(
      (appointmentId: string) => `appointment:${appointmentId}`,
    );
    realtime.buildIceServers.mockReturnValue([
      { urls: ['stun:stun.l.google.com:19302'] },
    ]);
    realtime.getParticipants.mockReturnValue([]);
    service = new ConsultationsService(
      prisma as unknown as PrismaService,
      realtime as unknown as RealtimeService,
      aiProxy as unknown as AiProxyService,
    );
  });

  describe('start', () => {
    it('rejects a non-confirmed appointment with 409 APPOINTMENT_NOT_CONFIRMED', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...buildAppointment({ status: 'pending_code' }),
        consultation: null,
      });

      const error = await expectHttpError(
        service.start(DOCTOR, 'appointment-1'),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'APPOINTMENT_NOT_CONFIRMED',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(realtime.emitToAppointment).not.toHaveBeenCalled();
    });

    it('rejects a second consultation with 409 CONSULTATION_EXISTS', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...buildAppointment(),
        consultation: { id: 'consultation-1' },
      });

      const error = await expectHttpError(
        service.start(DOCTOR, 'appointment-1'),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'CONSULTATION_EXISTS',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a doctor that does not own the appointment with 403 FORBIDDEN', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...buildAppointment({ doctorId: 'other-doctor' }),
        consultation: null,
      });

      const error = await expectHttpError(
        service.start(DOCTOR, 'appointment-1'),
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ errorCode: 'FORBIDDEN' });
    });

    it('returns 404 NOT_FOUND for an unknown appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      const error = await expectHttpError(
        service.start(DOCTOR, 'missing-appointment'),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ errorCode: 'NOT_FOUND' });
    });

    it('returns 409 APPOINTMENT_NOT_CONFIRMED when the appointment changes concurrently', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...buildAppointment(),
        consultation: null,
      });
      prisma.appointment.updateMany.mockResolvedValue({ count: 0 });

      const error = await expectHttpError(
        service.start(DOCTOR, 'appointment-1'),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'APPOINTMENT_NOT_CONFIRMED',
      });
      expect(realtime.emitToAppointment).not.toHaveBeenCalled();
    });

    it('starts the consultation and notifies the room and the patient', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...buildAppointment(),
        consultation: null,
      });
      prisma.consultation.create.mockResolvedValue(
        buildConsultation({ id: 'consultation-new' }),
      );
      prisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.start(DOCTOR, 'appointment-1');

      expect(result).toMatchObject({
        consultationId: 'consultation-new',
        appointmentId: 'appointment-1',
        status: 'active',
        roomId: 'appointment:appointment-1',
      });
      expect(result.iceServers).toHaveLength(1);
      expect(result.participants).toEqual([]);

      expect(prisma.consultation.create).toHaveBeenCalledWith({
        data: {
          appointmentId: 'appointment-1',
          status: 'active',
          startedAt: expect.any(Date) as Date,
        },
      });
      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appointment-1', status: 'confirmed' },
        data: { status: 'in_progress' },
      });

      expect(realtime.emitToAppointment).toHaveBeenCalledWith(
        'appointment-1',
        'consultation.started',
        expect.objectContaining({
          appointmentId: 'appointment-1',
          consultationId: 'consultation-new',
          doctorId: DOCTOR.sub,
          startedAt: expect.any(String) as string,
        }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith(
        PATIENT.sub,
        'consultation.started',
        expect.objectContaining({
          appointmentId: 'appointment-1',
          consultationId: 'consultation-new',
          doctorId: DOCTOR.sub,
          startedAt: expect.any(String) as string,
        }),
      );
      expect(aiProxy.openSession).toHaveBeenCalledWith({
        consultationId: 'consultation-new',
        appointmentId: 'appointment-1',
        doctorId: DOCTOR.sub,
      });
    });
  });

  describe('end', () => {
    it('rejects a consultation that is not active with 409 CONSULTATION_NOT_ACTIVE', async () => {
      prisma.consultation.findUnique.mockResolvedValue({
        ...buildConsultation({ status: 'ended', endedAt: new Date() }),
        appointment: buildAppointment({ status: 'completed' }),
      });

      const error = await expectHttpError(
        service.end(DOCTOR, 'consultation-1'),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'CONSULTATION_NOT_ACTIVE',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(realtime.emitToAppointment).not.toHaveBeenCalled();
    });

    it('rejects a doctor that does not own the consultation with 403 FORBIDDEN', async () => {
      prisma.consultation.findUnique.mockResolvedValue({
        ...buildConsultation(),
        appointment: buildAppointment({ doctorId: 'other-doctor' }),
      });

      const error = await expectHttpError(
        service.end(DOCTOR, 'consultation-1'),
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ errorCode: 'FORBIDDEN' });
    });

    it('ends the consultation and emits consultation.ended', async () => {
      prisma.consultation.findUnique.mockResolvedValue({
        ...buildConsultation(),
        appointment: buildAppointment({ status: 'in_progress' }),
      });
      prisma.consultation.updateMany.mockResolvedValue({ count: 1 });
      prisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.end(DOCTOR, 'consultation-1');

      expect(result).toMatchObject({
        consultationId: 'consultation-1',
        appointmentId: 'appointment-1',
        status: 'ended',
      });
      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appointment-1', status: 'in_progress' },
        data: { status: 'completed' },
      });
      expect(realtime.emitToAppointment).toHaveBeenCalledWith(
        'appointment-1',
        'consultation.ended',
        expect.objectContaining({
          appointmentId: 'appointment-1',
          consultationId: 'consultation-1',
          endedAt: expect.any(String) as string,
        }),
      );
      expect(aiProxy.closeSession).toHaveBeenCalledWith('consultation-1');
    });
  });
});
