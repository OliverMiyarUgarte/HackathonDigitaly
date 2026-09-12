import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AppointmentDto,
  AuthResponseDto,
  CalendarEntryDto,
  DoctorAppointmentDto,
  SlotDto,
} from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_PASSWORD = 'Demo@1234';
const PATIENT_EMAIL = 'paciente@digitaly.health';
const PATIENT_TWO_EMAIL = 'paciente2@digitaly.health';
const DOCTOR_EMAIL = 'medico@digitaly.health';

describe('Appointments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const startedAt = new Date();
  const createdAppointmentIds: string[] = [];
  let patientToken = '';
  let patientTwoToken = '';
  let doctorToken = '';
  let patientId = '';
  let doctorId = '';
  let bookedSlot: SlotDto;
  let appointmentId = '';

  const login = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: DEMO_PASSWORD })
      .expect(200);
    return (response.body as AuthResponseDto).tokens.accessToken;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    patientToken = await login(PATIENT_EMAIL);
    patientTwoToken = await login(PATIENT_TWO_EMAIL);
    doctorToken = await login(DOCTOR_EMAIL);

    const patient = await prisma.user.findUnique({
      where: { email: PATIENT_EMAIL },
      select: { id: true },
    });
    const doctor = await prisma.user.findUnique({
      where: { email: DOCTOR_EMAIL },
      select: { id: true },
    });
    patientId = patient?.id ?? '';
    doctorId = doctor?.id ?? '';
  });

  afterAll(async () => {
    if (createdAppointmentIds.length > 0) {
      await prisma.appointment.deleteMany({
        where: { id: { in: createdAppointmentIds } },
      });
    }
    const demoUsers = await prisma.user.findMany({
      where: {
        email: { in: [PATIENT_EMAIL, PATIENT_TWO_EMAIL, DOCTOR_EMAIL] },
      },
      select: { id: true },
    });
    if (demoUsers.length > 0) {
      await prisma.refreshToken.deleteMany({
        where: {
          userId: { in: demoUsers.map((user) => user.id) },
          createdAt: { gte: startedAt },
        },
      });
    }
    await app.close();
  });

  it('lists bookable slots for the seeded doctor', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/appointments/doctors/${doctorId}/slots`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const slots = response.body as SlotDto[];
    expect(slots.length).toBeGreaterThan(0);

    const futureSlot = slots.find(
      (slot) => new Date(slot.startsAt).getTime() > Date.now() + 60_000,
    );
    expect(futureSlot).toBeDefined();
    bookedSlot = futureSlot as SlotDto;

    expect(bookedSlot.doctorId).toBe(doctorId);
    expect(new Date(bookedSlot.endsAt).getTime()).toBe(
      new Date(bookedSlot.startsAt).getTime() + 30 * 60 * 1000,
    );
  });

  it('books a slot as pending_code with pre-consult answers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId,
        scheduledAt: bookedSlot.startsAt,
        preConsult: [{ questionKey: 'chief_complaint', answer: 'Palpitacoes' }],
      })
      .expect(201);

    const body = response.body as AppointmentDto;
    appointmentId = body.id;
    createdAppointmentIds.push(body.id);

    expect(body.status).toBe('pending_code');
    expect(body.patientId).toBe(patientId);
    expect(body.doctorId).toBe(doctorId);
    expect(body.scheduledAt).toBe(bookedSlot.startsAt);
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('shows the appointment in the patient calendar', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/appointments/calendar')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const entries = response.body as CalendarEntryDto[];
    const entry = entries.find((item) => item.appointmentId === appointmentId);

    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      appointmentId,
      status: 'pending_code',
      consultationId: null,
      counterpart: { id: doctorId, role: 'doctor' },
    });
  });

  it('shows the appointment in the doctor list with the pre-consult flag', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/appointments/doctor')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const entries = response.body as DoctorAppointmentDto[];
    const entry = entries.find((item) => item.appointmentId === appointmentId);

    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      appointmentId,
      status: 'pending_code',
      consultationId: null,
      hasPreConsult: true,
      patient: { id: patientId, role: 'patient' },
    });
  });

  it('rejects a second overlapping booking with 409 SLOT_TAKEN', () => {
    return request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: bookedSlot.startsAt })
      .expect(409)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'SLOT_TAKEN' });
      });
  });

  it('allows exactly one of two concurrent bookings for the same slot', async () => {
    const slotsResponse = await request(app.getHttpServer())
      .get(`/api/appointments/doctors/${doctorId}/slots`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const target = (slotsResponse.body as SlotDto[]).find(
      (slot) =>
        new Date(slot.startsAt).getTime() >
        Date.now() + 2 * 24 * 60 * 60 * 1000,
    );
    expect(target).toBeDefined();
    const scheduledAt = (target as SlotDto).startsAt;

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ doctorId, scheduledAt }),
      request(app.getHttpServer())
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientTwoToken}`)
        .send({ doctorId, scheduledAt }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);

    for (const response of [first, second]) {
      if (response.status === 201) {
        createdAppointmentIds.push((response.body as AppointmentDto).id);
      } else {
        expect(response.body).toMatchObject({ error: 'SLOT_TAKEN' });
      }
    }
  });

  it('forbids another patient from reading the appointment', () => {
    return request(app.getHttpServer())
      .get(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patientTwoToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('forbids another patient from cancelling the appointment', () => {
    return request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientTwoToken}`)
      .send({ reason: 'Nao sou o paciente' })
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('cancels the appointment and rejects a second cancel as terminal', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: 'Imprevisto' })
      .expect(200);

    const body = response.body as AppointmentDto;
    expect(body.status).toBe('cancelled');

    await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({})
      .expect(409)
      .expect((rejected) => {
        expect(rejected.body).toMatchObject({
          error: 'APPOINTMENT_TERMINAL',
        });
      });
  });
});
