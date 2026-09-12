import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AuthResponseDto,
  DoctorSummaryDto,
  UserDto,
} from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PATIENT_EMAIL = 'paciente@digitaly.health';
const PATIENT_TWO_EMAIL = 'paciente2@digitaly.health';
const DOCTOR_EMAIL = 'medico@digitaly.health';
const DEMO_PASSWORD = 'Demo@1234';

function expectNoPasswordHash(body: unknown): void {
  expect(JSON.stringify(body)).not.toContain('passwordHash');
}

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const startedAt = new Date();
  const suffix = Date.now();
  const doctorEmail = `users-doctor+${suffix}@digitaly.health`;
  const doctorName = `E2E Doctor ${suffix}`;
  const doctorSpecialty = `E2E Specialty ${suffix}`;
  let doctorId = '';
  let accessToken = '';
  let unlinkedPatientId = '';
  let linkedPatientId = '';
  let createdAppointmentId = '';

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

    const linkedPatient = await prisma.user.findUnique({
      where: { email: PATIENT_EMAIL },
      select: { id: true },
    });
    const unlinkedPatient = await prisma.user.findUnique({
      where: { email: PATIENT_TWO_EMAIL },
      select: { id: true },
    });
    linkedPatientId = linkedPatient?.id ?? '';
    unlinkedPatientId = unlinkedPatient?.id ?? '';

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: doctorName,
        email: doctorEmail,
        password: DEMO_PASSWORD,
        role: 'doctor',
        specialty: doctorSpecialty,
        crm: 'CRM-E2E 000001',
      })
      .expect(201);
    const auth = registration.body as AuthResponseDto;
    doctorId = auth.user.id;
    accessToken = auth.tokens.accessToken;

    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId: linkedPatientId,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'confirmed',
      },
      select: { id: true },
    });
    createdAppointmentId = appointment.id;
  });

  afterAll(async () => {
    if (createdAppointmentId) {
      await prisma.appointment.deleteMany({
        where: { id: createdAppointmentId },
      });
    }
    if (doctorId) {
      await prisma.user.deleteMany({ where: { id: doctorId } });
    }
    const demoUsers = await prisma.user.findMany({
      where: {
        email: { in: [DOCTOR_EMAIL, PATIENT_EMAIL, PATIENT_TWO_EMAIL] },
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

  it('rejects /users/me without a token', () =>
    request(app.getHttpServer()).get('/api/users/me').expect(401));

  it('returns the authenticated user profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as UserDto;
    expect(body.id).toBe(doctorId);
    expect(body.email).toBe(doctorEmail);
    expect(body.role).toBe('doctor');
    expect(body.specialty).toBe(doctorSpecialty);
    expectNoPasswordHash(body);
  });

  it('lists doctors and filters by specialty and name', async () => {
    const bySpecialty = await request(app.getHttpServer())
      .get('/api/users/doctors')
      .query({ specialty: doctorSpecialty })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const specialtyResults = bySpecialty.body as DoctorSummaryDto[];
    expect(specialtyResults).toHaveLength(1);
    expect(specialtyResults[0]).toMatchObject({
      id: doctorId,
      specialty: doctorSpecialty,
    });
    expectNoPasswordHash(specialtyResults);

    const byName = await request(app.getHttpServer())
      .get('/api/users/doctors')
      .query({ q: doctorName })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const nameResults = byName.body as DoctorSummaryDto[];
    expect(nameResults).toHaveLength(1);
    expect(nameResults[0]).toMatchObject({ id: doctorId, name: doctorName });
  });

  it('returns a patient linked to the authenticated doctor', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/users/patients/${linkedPatientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as UserDto;
    expect(body.id).toBe(linkedPatientId);
    expect(body.role).toBe('patient');
    expectNoPasswordHash(body);
  });

  it('forbids a doctor from reading an unlinked patient', () =>
    request(app.getHttpServer())
      .get(`/api/users/patients/${unlinkedPatientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
        expectNoPasswordHash(response.body);
      }));

  it('updates only name and specialty on the authenticated profile', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `Updated ${suffix}`,
        specialty: `Updated Specialty ${suffix}`,
      })
      .expect(200);

    const body = response.body as UserDto;
    expect(body.id).toBe(doctorId);
    expect(body.name).toBe(`Updated ${suffix}`);
    expect(body.specialty).toBe(`Updated Specialty ${suffix}`);
    expect(body.email).toBe(doctorEmail);
    expect(body.role).toBe('doctor');
    expectNoPasswordHash(body);
  });

  it('rejects attempts to change role, email, or password', () =>
    request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'patient', email: 'attacker@example.test', password: 'x' })
      .expect(400)
      .expect((response) => {
        expectNoPasswordHash(response.body);
      }));

  it('forbids a patient from reading a patient profile', async () => {
    const patientToken = await login(PATIENT_EMAIL);
    await request(app.getHttpServer())
      .get(`/api/users/patients/${linkedPatientId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(403);
  });
});
