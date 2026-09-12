import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PRE_CONSULT_QUESTION_KEYS,
  type AppointmentDto,
  type AuthResponseDto,
  type ConsultationHistoryItemDto,
  type EndConsultationResponseDto,
  type MedicalRecordDto,
  type PatientOverviewDto,
  type PreConsultAnswerDto,
  type SlotDto,
  type StartConsultationResponseDto,
} from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_PASSWORD = 'Demo@1234';
const DOCTOR_EMAIL = 'medico@digitaly.health';
const SECOND_PATIENT_EMAIL = 'paciente2@digitaly.health';

const PRE_CONSULT_PAYLOAD = [
  { questionKey: 'chief_complaint', answer: 'Palpitacoes frequentes' },
  { questionKey: 'symptom_duration', answer: 'Cerca de tres semanas' },
  { questionKey: 'current_medications', answer: 'Losartana 50mg' },
  { questionKey: 'allergies', answer: 'Nega alergias medicamentosas' },
  { questionKey: 'medical_history', answer: 'Hipertensao arterial' },
] as const;

const RECORD_PAYLOAD = {
  notes: 'Paciente relata palpitacoes em repouso. Exame fisico sem alteracoes.',
  diagnosis: 'Hipertensao arterial sistemica compensada',
  prescriptions: ['Losartana 50mg 2x ao dia'],
};

describe('Records (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const startedAt = new Date();
  const sentCodes: { to: string; code: string }[] = [];
  const createdAppointmentIds: string[] = [];

  let doctorToken = '';
  let doctorId = '';
  let patientToken = '';
  let patientId = '';
  let patientEmail = '';
  let patientTwoToken = '';
  let patientTwoId = '';
  let appointmentId = '';
  let consultationId = '';
  let recordId = '';

  const mailStub = {
    sendValidationCode: jest.fn((to: string, code: string): Promise<void> => {
      sentCodes.push({ to, code });
      return Promise.resolve();
    }),
  };

  const login = async (email: string): Promise<AuthResponseDto> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: DEMO_PASSWORD })
      .expect(200);
    return response.body as AuthResponseDto;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const doctor = await login(DOCTOR_EMAIL);
    doctorToken = doctor.tokens.accessToken;
    doctorId = doctor.user.id;

    const patientTwo = await login(SECOND_PATIENT_EMAIL);
    patientTwoToken = patientTwo.tokens.accessToken;
    patientTwoId = patientTwo.user.id;

    const registeredEmail = `records+${Date.now()}@digitaly.health`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Records Patient',
        email: registeredEmail,
        password: DEMO_PASSWORD,
        role: 'patient',
      })
      .expect(201);
    const patient = registerResponse.body as AuthResponseDto;
    patientToken = patient.tokens.accessToken;
    patientId = patient.user.id;
    patientEmail = registeredEmail;

    const slotsResponse = await request(app.getHttpServer())
      .get(`/api/appointments/doctors/${doctorId}/slots`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    const slots = slotsResponse.body as SlotDto[];
    const preferred = slots.filter(
      (slot) =>
        new Date(slot.startsAt).getTime() >
        Date.now() + 2 * 24 * 60 * 60 * 1000,
    );
    const slot =
      preferred.length > 0 ? preferred[preferred.length - 1] : slots[0];
    if (!slot) {
      throw new Error('No bookable slot available');
    }

    const booking = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: slot.startsAt })
      .expect(201);
    appointmentId = (booking.body as AppointmentDto).id;
    createdAppointmentIds.push(appointmentId);

    await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/request-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    const code = sentCodes[0]?.code;
    if (!code) {
      throw new Error('Validation code was not captured');
    }

    await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/verify-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ code })
      .expect(200);
  });

  afterAll(async () => {
    if (prisma) {
      if (createdAppointmentIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: {
            resourceType: 'appointment',
            resourceId: { in: createdAppointmentIds },
          },
        });
        await prisma.appointment.deleteMany({
          where: { id: { in: createdAppointmentIds } },
        });
      }
      const userIds = [doctorId, patientTwoId].filter((id) => id.length > 0);
      if (userIds.length > 0) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIds }, createdAt: { gte: startedAt } },
        });
      }
      if (patientId) {
        await prisma.user.deleteMany({ where: { id: patientId } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('lets the patient upsert pre-consult answers without duplication', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/appointments/${appointmentId}/pre-consult`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send([...PRE_CONSULT_PAYLOAD, ...PRE_CONSULT_PAYLOAD])
      .expect(200);

    const answers = response.body as PreConsultAnswerDto[];
    expect(answers).toHaveLength(PRE_CONSULT_QUESTION_KEYS.length);
    expect(answers.map((answer) => answer.questionKey).sort()).toEqual(
      [...PRE_CONSULT_QUESTION_KEYS].sort(),
    );
    expect(JSON.stringify(answers)).not.toContain('passwordHash');
  });

  it('returns the pre-consult answers to the doctor', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/appointments/${appointmentId}/pre-consult`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const answers = response.body as PreConsultAnswerDto[];
    expect(answers).toHaveLength(PRE_CONSULT_QUESTION_KEYS.length);
  });

  it('rejects pre-consult updates from a different patient', () => {
    return request(app.getHttpServer())
      .put(`/api/appointments/${appointmentId}/pre-consult`)
      .set('Authorization', `Bearer ${patientTwoToken}`)
      .send([{ questionKey: 'chief_complaint', answer: 'Intruso' }])
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('shows the patient overview to the linked doctor without leaking PII', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/patients/${patientId}/overview`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const overview = response.body as PatientOverviewDto;
    expect(overview.patient).toMatchObject({
      id: patientId,
      email: patientEmail,
      role: 'patient',
    });
    expect(overview.patient).not.toHaveProperty('passwordHash');
    expect(overview.upcomingAppointment?.id).toBe(appointmentId);
    expect(overview.preConsult).toHaveLength(PRE_CONSULT_QUESTION_KEYS.length);
    expect(Array.isArray(overview.history)).toBe(true);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain(SECOND_PATIENT_EMAIL);
  });

  it('lets the patient read their own overview', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/patients/${patientId}/overview`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const overview = response.body as PatientOverviewDto;
    expect(overview.patient.id).toBe(patientId);
    expect(overview.upcomingAppointment?.id).toBe(appointmentId);
  });

  it('forbids the second patient from reading the overview', () => {
    return request(app.getHttpServer())
      .get(`/api/patients/${patientId}/overview`)
      .set('Authorization', `Bearer ${patientTwoToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('starts and ends the consultation as the doctor', async () => {
    const started = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/consultations/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    const startBody = started.body as StartConsultationResponseDto;
    consultationId = startBody.consultationId;
    expect(startBody).toMatchObject({
      appointmentId,
      status: 'active',
    });

    const ended = await request(app.getHttpServer())
      .post(`/api/consultations/${consultationId}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    const endBody = ended.body as EndConsultationResponseDto;
    expect(endBody).toMatchObject({
      consultationId,
      appointmentId,
      status: 'ended',
    });
  });

  it('creates a medical record for the consultation', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        consultationId,
        patientId,
        ...RECORD_PAYLOAD,
      })
      .expect(201);

    const record = response.body as MedicalRecordDto;
    recordId = record.id;
    expect(record).toMatchObject({
      patientId,
      consultationId,
      createdBy: doctorId,
      diagnosis: RECORD_PAYLOAD.diagnosis,
      prescriptions: RECORD_PAYLOAD.prescriptions,
    });
    expect(JSON.stringify(record)).not.toContain('passwordHash');
  });

  it('rejects a duplicate record with 409 RECORD_EXISTS', () => {
    return request(app.getHttpServer())
      .post('/api/records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ consultationId, patientId, ...RECORD_PAYLOAD })
      .expect(409)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'RECORD_EXISTS' });
      });
  });

  it('returns the record history with the diagnosis to the doctor', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/records/history?patientId=${patientId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const items = response.body as ConsultationHistoryItemDto[];
    const item = items.find((entry) => entry.consultationId === consultationId);
    expect(item).toBeDefined();
    expect(item).toMatchObject({
      consultationId,
      appointmentId,
      diagnosis: RECORD_PAYLOAD.diagnosis,
      doctor: { id: doctorId, role: 'doctor' },
    });
    expect(JSON.stringify(response.body)).not.toContain(SECOND_PATIENT_EMAIL);
  });

  it('lets the patient read their own record and history', async () => {
    const record = await request(app.getHttpServer())
      .get(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect((record.body as MedicalRecordDto).patientId).toBe(patientId);

    const history = await request(app.getHttpServer())
      .get('/api/records/history')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    const items = history.body as ConsultationHistoryItemDto[];
    expect(items.some((entry) => entry.consultationId === consultationId)).toBe(
      true,
    );
  });

  it('forbids the second patient from reading the record', () => {
    return request(app.getHttpServer())
      .get(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${patientTwoToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });
});
