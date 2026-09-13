import { HttpException } from '@nestjs/common';
import type { AuditService } from '../common/audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type {
  Appointment,
  Consultation,
  MedicalRecord,
  PreConsultAnswer,
  User,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AppointmentAccessService } from '../appointments/appointment-access.service';
import { RecordsService } from './records.service';

const PATIENT: AuthenticatedUser = { sub: 'patient-1', role: 'patient' };
const OTHER_PATIENT: AuthenticatedUser = {
  sub: 'patient-other',
  role: 'patient',
};
const DOCTOR: AuthenticatedUser = { sub: 'doctor-1', role: 'doctor' };

interface UserDelegateMock {
  findFirst: jest.Mock;
}

interface AppointmentDelegateMock {
  findFirst: jest.Mock;
}

interface ConsultationDelegateMock {
  findUnique: jest.Mock;
  findMany: jest.Mock;
}

interface MedicalRecordDelegateMock {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
}

interface PreConsultAnswerDelegateMock {
  findMany: jest.Mock;
  upsert: jest.Mock;
}

interface PrismaMock {
  $transaction: jest.Mock<
    Promise<unknown>,
    [(tx: PrismaMock) => Promise<unknown>]
  >;
  user: UserDelegateMock;
  appointment: AppointmentDelegateMock;
  consultation: ConsultationDelegateMock;
  medicalRecord: MedicalRecordDelegateMock;
  preConsultAnswer: PreConsultAnswerDelegateMock;
}

interface AccessMock {
  assertAppointmentAccess: jest.Mock;
  assertPatientAccess: jest.Mock;
}

interface AuditMock {
  record: jest.Mock<Promise<void>, [unknown]>;
}

function createAuditMock(): AuditMock {
  return {
    record: jest.fn<Promise<void>, [unknown]>(() => Promise.resolve()),
  };
}

function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: PrismaMock) => Promise<unknown>]
    >(),
    user: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn() },
    consultation: { findUnique: jest.fn(), findMany: jest.fn() },
    medicalRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    preConsultAnswer: { findMany: jest.fn(), upsert: jest.fn() },
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
    status: 'ended',
    startedAt: new Date('2026-06-01T10:00:00.000Z'),
    endedAt: new Date('2026-06-01T10:30:00.000Z'),
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:30:00.000Z'),
    ...overrides,
  };
}

function buildRecord(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
  return {
    id: 'record-1',
    patientId: PATIENT.sub,
    consultationId: 'consultation-1',
    createdBy: DOCTOR.sub,
    notes: 'Notas da consulta',
    diagnosis: 'Hipertensao',
    prescriptions: ['Losartana 50mg'],
    createdAt: new Date('2026-06-01T10:35:00.000Z'),
    updatedAt: new Date('2026-06-01T10:35:00.000Z'),
    ...overrides,
  };
}

function buildAnswer(
  overrides: Partial<PreConsultAnswer> = {},
): PreConsultAnswer {
  return {
    id: 'answer-1',
    appointmentId: 'appointment-1',
    questionKey: 'chief_complaint',
    answer: 'Palpitacoes',
    createdAt: new Date('2026-06-01T09:00:00.000Z'),
    updatedAt: new Date('2026-06-01T09:00:00.000Z'),
    ...overrides,
  };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: PATIENT.sub,
    role: 'patient',
    name: 'Joao Pereira',
    email: 'paciente@digitaly.health',
    passwordHash: 'secret-hash',
    specialty: null,
    crm: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
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

describe('RecordsService', () => {
  let service: RecordsService;
  let prisma: PrismaMock;
  let access: AccessMock;
  let audit: AuditMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    access = createAccessMock();
    audit = createAuditMock();
    service = new RecordsService(
      prisma as unknown as PrismaService,
      access as unknown as AppointmentAccessService,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('rejects a duplicate record with 409 RECORD_EXISTS', async () => {
      prisma.consultation.findUnique.mockResolvedValue({
        ...buildConsultation(),
        appointment: { doctorId: DOCTOR.sub, patientId: PATIENT.sub },
      });
      prisma.medicalRecord.findUnique.mockResolvedValue({ id: 'record-1' });

      const error = await expectHttpError(
        service.create(DOCTOR, {
          consultationId: 'consultation-1',
          patientId: PATIENT.sub,
          notes: 'Notas',
        }),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'RECORD_EXISTS',
      });
      expect(prisma.medicalRecord.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique violation to 409 RECORD_EXISTS', async () => {
      prisma.consultation.findUnique.mockResolvedValue({
        ...buildConsultation(),
        appointment: { doctorId: DOCTOR.sub, patientId: PATIENT.sub },
      });
      prisma.medicalRecord.findUnique.mockResolvedValue(null);
      prisma.medicalRecord.create.mockRejectedValue({ code: 'P2002' });

      const error = await expectHttpError(
        service.create(DOCTOR, {
          consultationId: 'consultation-1',
          patientId: PATIENT.sub,
          notes: 'Notas',
        }),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'RECORD_EXISTS',
      });
    });

    it('rejects a consultation from another doctor with 403 FORBIDDEN', async () => {
      prisma.consultation.findUnique.mockResolvedValue({
        ...buildConsultation(),
        appointment: { doctorId: 'other-doctor', patientId: PATIENT.sub },
      });

      const error = await expectHttpError(
        service.create(DOCTOR, {
          consultationId: 'consultation-1',
          patientId: PATIENT.sub,
          notes: 'Notas',
        }),
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ errorCode: 'FORBIDDEN' });
    });

    it('creates the record and records a medical_record.create audit entry', async () => {
      prisma.consultation.findUnique.mockResolvedValue({
        ...buildConsultation(),
        appointment: { doctorId: DOCTOR.sub, patientId: PATIENT.sub },
      });
      prisma.medicalRecord.findUnique.mockResolvedValue(null);
      prisma.medicalRecord.create.mockResolvedValue(buildRecord());

      const result = await service.create(DOCTOR, {
        consultationId: 'consultation-1',
        patientId: PATIENT.sub,
        notes: 'Notas',
      });

      expect(result.id).toBe('record-1');
      expect(audit.record).toHaveBeenCalledWith({
        actorId: DOCTOR.sub,
        action: 'medical_record.create',
        resourceType: 'medical_record',
        resourceId: 'record-1',
        outcome: 'success',
      });
    });
  });

  describe('putPreConsult', () => {
    it('rejects answers for a completed appointment with 409 CONFLICT', async () => {
      access.assertAppointmentAccess.mockResolvedValue(
        buildAppointment({ status: 'completed' }),
      );

      const error = await expectHttpError(
        service.putPreConsult(PATIENT, 'appointment-1', [
          { questionKey: 'chief_complaint', answer: 'Palpitacoes' },
        ]),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: 'CONFLICT' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('upserts answers without duplication and returns the saved set', async () => {
      access.assertAppointmentAccess.mockResolvedValue(
        buildAppointment({ status: 'pending_code' }),
      );
      prisma.preConsultAnswer.findMany.mockResolvedValue([buildAnswer()]);

      const result = await service.putPreConsult(PATIENT, 'appointment-1', [
        { questionKey: 'chief_complaint', answer: 'Palpitacoes' },
        { questionKey: 'chief_complaint', answer: 'Palpitacoes frequentes' },
      ]);

      expect(prisma.preConsultAnswer.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.preConsultAnswer.upsert).toHaveBeenCalledWith({
        where: {
          appointmentId_questionKey: {
            appointmentId: 'appointment-1',
            questionKey: 'chief_complaint',
          },
        },
        update: { answer: 'Palpitacoes frequentes' },
        create: {
          appointmentId: 'appointment-1',
          questionKey: 'chief_complaint',
          answer: 'Palpitacoes frequentes',
        },
      });
      expect(result).toEqual([
        {
          id: 'answer-1',
          appointmentId: 'appointment-1',
          questionKey: 'chief_complaint',
          answer: 'Palpitacoes',
          createdAt: '2026-06-01T09:00:00.000Z',
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('forbids a patient from reading another patient record with 403', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(
        buildRecord({ patientId: OTHER_PATIENT.sub }),
      );

      const error = await expectHttpError(service.findOne(PATIENT, 'record-1'));

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ errorCode: 'FORBIDDEN' });
      expect(access.assertPatientAccess).not.toHaveBeenCalled();
    });

    it('returns 404 NOT_FOUND for an unknown record', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(null);

      const error = await expectHttpError(
        service.findOne(PATIENT, 'missing-record'),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ errorCode: 'NOT_FOUND' });
    });

    it('returns the record and records a medical_record.read audit entry', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(buildRecord());

      const record = await service.findOne(PATIENT, 'record-1');

      expect(record.id).toBe('record-1');
      expect(audit.record).toHaveBeenCalledWith({
        actorId: PATIENT.sub,
        action: 'medical_record.read',
        resourceType: 'medical_record',
        resourceId: 'record-1',
        outcome: 'success',
      });
    });
  });

  describe('getPatientOverview', () => {
    it('maps only contract fields and never exposes the password hash', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUser());
      prisma.appointment.findFirst.mockResolvedValue(buildAppointment());
      prisma.medicalRecord.findMany.mockResolvedValue([buildRecord()]);
      prisma.preConsultAnswer.findMany.mockResolvedValue([buildAnswer()]);

      const overview = await service.getPatientOverview(DOCTOR, PATIENT.sub);

      expect(overview.patient).toEqual({
        id: PATIENT.sub,
        name: 'Joao Pereira',
        email: 'paciente@digitaly.health',
        role: 'patient',
        specialty: null,
        crm: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(overview.patient).not.toHaveProperty('passwordHash');
      expect(overview.upcomingAppointment).toMatchObject({
        id: 'appointment-1',
        patientId: PATIENT.sub,
        status: 'confirmed',
      });
      expect(overview.history).toEqual([
        {
          id: 'record-1',
          consultationId: 'consultation-1',
          createdAt: '2026-06-01T10:35:00.000Z',
          diagnosis: 'Hipertensao',
        },
      ]);
      expect(overview.preConsult).toHaveLength(1);
      expect(access.assertPatientAccess).toHaveBeenCalledWith(
        DOCTOR,
        PATIENT.sub,
      );
      expect(audit.record).toHaveBeenCalledWith({
        actorId: DOCTOR.sub,
        action: 'patient.overview.read',
        resourceType: 'patient',
        resourceId: PATIENT.sub,
        outcome: 'success',
      });
    });

    it('forbids a patient from reading another patient overview with 403', async () => {
      const error = await expectHttpError(
        service.getPatientOverview(PATIENT, OTHER_PATIENT.sub),
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ errorCode: 'FORBIDDEN' });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('restricts a doctor without patientId to their own appointments', async () => {
      prisma.consultation.findMany.mockResolvedValue([]);

      await service.getHistory(DOCTOR, {});

      expect(access.assertPatientAccess).not.toHaveBeenCalled();
      expect(prisma.consultation.findMany).toHaveBeenCalledWith({
        where: { appointment: { doctorId: DOCTOR.sub } },
        include: {
          appointment: { include: { doctor: true } },
          medicalRecord: { select: { diagnosis: true } },
        },
        orderBy: { startedAt: 'desc' },
      });
      expect(audit.record).toHaveBeenCalledWith({
        actorId: DOCTOR.sub,
        action: 'consultation.history.read',
        resourceType: 'consultation_history',
        resourceId: DOCTOR.sub,
        outcome: 'success',
      });
    });

    it('validates patientId with the access service for a doctor', async () => {
      prisma.consultation.findMany.mockResolvedValue([]);

      await service.getHistory(DOCTOR, { patientId: PATIENT.sub });

      expect(access.assertPatientAccess).toHaveBeenCalledWith(
        DOCTOR,
        PATIENT.sub,
      );
      expect(prisma.consultation.findMany).toHaveBeenCalledWith({
        where: { appointment: { patientId: PATIENT.sub } },
        include: {
          appointment: { include: { doctor: true } },
          medicalRecord: { select: { diagnosis: true } },
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('forbids a doctor from listing a patient they are not linked to', async () => {
      access.assertPatientAccess.mockRejectedValue(
        new HttpException({ errorCode: 'FORBIDDEN' }, 403),
      );

      const error = await expectHttpError(
        service.getHistory(DOCTOR, { patientId: OTHER_PATIENT.sub }),
      );

      expect(error.getStatus()).toBe(403);
      expect(prisma.consultation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getPreConsult', () => {
    it('returns answers and records a pre_consult.read audit entry without contents', async () => {
      access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
      prisma.preConsultAnswer.findMany.mockResolvedValue([buildAnswer()]);

      const result = await service.getPreConsult(DOCTOR, 'appointment-1');

      expect(result).toHaveLength(1);
      expect(audit.record).toHaveBeenCalledWith({
        actorId: DOCTOR.sub,
        action: 'pre_consult.read',
        resourceType: 'pre_consult',
        resourceId: 'appointment-1',
        outcome: 'success',
      });
      expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
        'Palpitacoes',
      );
    });

    it('does not audit when appointment access is denied', async () => {
      access.assertAppointmentAccess.mockRejectedValue(
        new HttpException({ errorCode: 'FORBIDDEN' }, 403),
      );

      const error = await expectHttpError(
        service.getPreConsult(PATIENT, 'appointment-1'),
      );

      expect(error.getStatus()).toBe(403);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
