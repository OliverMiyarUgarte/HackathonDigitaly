import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AppointmentDto,
  AuthResponseDto,
  CalendarEntryDto,
  RequestCodeResponseDto,
  SlotDto,
} from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_PASSWORD = 'Demo@1234';
const DOCTOR_EMAIL = 'medico@digitaly.health';
const PATIENT_TWO_EMAIL = 'paciente2@digitaly.health';

describe('Validation code (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const startedAt = new Date();
  const sentCodes: { to: string; code: string }[] = [];
  const createdAppointmentIds: string[] = [];
  let freshUserId = '';
  let registeredEmail = '';
  let patientToken = '';
  let patientTwoToken = '';
  let doctorId = '';
  let appointmentId = '';
  let firstCode = '';
  let latestCode = '';

  const mailStub = {
    sendValidationCode: jest.fn((to: string, code: string): Promise<void> => {
      sentCodes.push({ to, code });
      return Promise.resolve();
    }),
  };

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

    registeredEmail = `otp+${Date.now()}@digitaly.health`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E OTP Patient',
        email: registeredEmail,
        password: DEMO_PASSWORD,
        role: 'patient',
      })
      .expect(201);
    const auth = registerResponse.body as AuthResponseDto;
    freshUserId = auth.user.id;
    patientToken = auth.tokens.accessToken;

    patientTwoToken = await login(PATIENT_TWO_EMAIL);

    const doctor = await prisma.user.findUnique({
      where: { email: DOCTOR_EMAIL },
      select: { id: true },
    });
    doctorId = doctor?.id ?? '';

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
      preferred.length > 0
        ? preferred[preferred.length - 1]
        : slots[slots.length - 1];
    if (!slot) {
      throw new Error('No bookable slot available');
    }

    const booking = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: slot.startsAt })
      .expect(201);
    const appointment = booking.body as AppointmentDto;
    appointmentId = appointment.id;
    createdAppointmentIds.push(appointment.id);
  });

  afterAll(async () => {
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
    if (freshUserId) {
      await prisma.user.deleteMany({ where: { id: freshUserId } });
    }
    const demoUsers = await prisma.user.findMany({
      where: { email: { in: [DOCTOR_EMAIL, PATIENT_TWO_EMAIL] } },
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

  it('requests a code and returns the contract response', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/request-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const body = response.body as RequestCodeResponseDto;
    expect(body.appointmentId).toBe(appointmentId);
    expect(body.attemptsRemaining).toBe(5);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    expect(sentCodes).toHaveLength(1);
    expect(sentCodes[0].to).toBe(registeredEmail);
    firstCode = sentCodes[0].code;
    latestCode = firstCode;
    expect(firstCode).toMatch(/^\d{6}$/);
  });

  it('rejects a wrong code without confirming the appointment', async () => {
    const wrongCode = firstCode === '000000' ? '111111' : '000000';

    await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/verify-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ code: wrongCode })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          error: 'INVALID_OR_EXPIRED_CODE',
        });
      });

    const appointment = await request(app.getHttpServer())
      .get(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect((appointment.body as AppointmentDto).status).toBe('pending_code');
  });

  it('resends a code and invalidates the previous one', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/resend-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const body = response.body as RequestCodeResponseDto;
    expect(body.appointmentId).toBe(appointmentId);
    expect(body.attemptsRemaining).toBe(4);
    expect(sentCodes).toHaveLength(2);
    latestCode = sentCodes[1].code;

    const codes = await prisma.validationCode.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'asc' },
    });
    const active = codes.filter((code) => code.consumedAt === null);
    expect(active).toHaveLength(1);
    expect(active[0].codeHash).not.toBe(latestCode);
    expect(active[0].attempts).toBe(1);
  });

  it('confirms the appointment with the captured code', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/verify-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ code: latestCode })
      .expect(200);

    expect((response.body as AppointmentDto).status).toBe('confirmed');
  });

  it('rejects reuse of the same code', async () => {
    await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/verify-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ code: latestCode })
      .expect(409)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'CONFLICT' });
      });
  });

  it('shows the appointment as confirmed in the patient calendar', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/appointments/calendar')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const entries = response.body as CalendarEntryDto[];
    const entry = entries.find((item) => item.appointmentId === appointmentId);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('confirmed');
  });

  it('forbids another patient from requesting a code', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/request-code`)
      .set('Authorization', `Bearer ${patientTwoToken}`)
      .expect(403);
    expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
  });

  it('never persists the code in plaintext', async () => {
    const codes = await prisma.validationCode.findMany({
      where: { appointmentId },
    });
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(code.codeHash).not.toBe(firstCode);
      expect(code.codeHash).not.toBe(latestCode);
    }
  });
});
