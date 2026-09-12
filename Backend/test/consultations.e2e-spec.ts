import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AppointmentDto,
  AuthResponseDto,
  CalendarEntryDto,
  ClientToServerEvents,
  ConsultationDto,
  ConsultationHistoryItemDto,
  ServerToClientEvents,
  SlotDto,
  StartConsultationResponseDto,
  EndConsultationResponseDto,
} from '@telemed/service-contracts';
import type { Server } from 'node:http';
import { io, type Socket as IoSocket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

type ClientSocket = IoSocket<ServerToClientEvents, ClientToServerEvents>;

interface ListenerSocket {
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: (payload: Parameters<ServerToClientEvents[K]>[0]) => void,
  ): unknown;
  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler: (payload: Parameters<ServerToClientEvents[K]>[0]) => void,
  ): unknown;
}

const DEMO_PASSWORD = 'Demo@1234';
const DOCTOR_EMAIL = 'medico2@digitaly.health';

describe('Consultations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let port = 0;
  const startedAt = new Date();
  const sentCodes: { to: string; code: string }[] = [];
  const createdAppointmentIds: string[] = [];
  const sockets: ClientSocket[] = [];

  let freshUserId = '';
  let patientToken = '';
  let doctorToken = '';
  let patientId = '';
  let doctorId = '';
  let appointmentId = '';
  let consultationId = '';
  let patientSocket: ClientSocket;

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

  const connectSocket = (token: string): Promise<ClientSocket> =>
    new Promise((resolve, reject) => {
      const socket = io(`http://127.0.0.1:${port}/realtime`, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      }) as unknown as ClientSocket;
      sockets.push(socket);

      const onConnect = (): void => {
        socket.off('connect_error', onError);
        resolve(socket);
      };
      const onError = (error: Error): void => {
        socket.off('connect', onConnect);
        reject(error);
      };

      socket.on('connect', onConnect);
      socket.on('connect_error', onError);
    });

  const waitFor = <K extends keyof ServerToClientEvents>(
    socket: ClientSocket,
    event: K,
    timeoutMs = 5000,
  ): Promise<Parameters<ServerToClientEvents[K]>[0]> =>
    new Promise((resolve, reject) => {
      const listeners = socket as unknown as ListenerSocket;
      const timer = setTimeout(() => {
        listeners.off(event, handler);
        reject(new Error(`Timed out waiting for ${String(event)}`));
      }, timeoutMs);
      const handler = (
        payload: Parameters<ServerToClientEvents[K]>[0],
      ): void => {
        clearTimeout(timer);
        listeners.off(event, handler);
        resolve(payload);
      };
      listeners.on(event, handler);
    });

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
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const address = httpServer.address();
    port = typeof address === 'object' && address !== null ? address.port : 0;

    prisma = app.get(PrismaService);

    const doctor = await login(DOCTOR_EMAIL);
    doctorToken = doctor.tokens.accessToken;
    doctorId = doctor.user.id;

    const registeredEmail = `consult+${Date.now()}@digitaly.health`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Consultation Patient',
        email: registeredEmail,
        password: DEMO_PASSWORD,
        role: 'patient',
      })
      .expect(201);
    const patientAuth = registerResponse.body as AuthResponseDto;
    freshUserId = patientAuth.user.id;
    patientToken = patientAuth.tokens.accessToken;
    patientId = patientAuth.user.id;

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

    patientSocket = await connectSocket(patientToken);
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }

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
      if (freshUserId) {
        await prisma.user.deleteMany({ where: { id: freshUserId } });
      }
      await prisma.refreshToken.deleteMany({
        where: { userId: doctorId, createdAt: { gte: startedAt } },
      });
    }

    if (app) {
      await app.close();
    }
  });

  it('starts the consultation and notifies the patient not in the room', async () => {
    const startedEvent = waitFor(patientSocket, 'consultation.started');

    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/consultations/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);

    const body = response.body as StartConsultationResponseDto;
    consultationId = body.consultationId;

    expect(body).toMatchObject({
      appointmentId,
      status: 'active',
      roomId: `appointment:${appointmentId}`,
    });
    expect(new Date(body.startedAt).getTime()).not.toBeNaN();
    expect(body.iceServers.length).toBeGreaterThan(0);
    expect(body.iceServers[0].urls[0]).toContain('stun:');
    expect(Array.isArray(body.participants)).toBe(true);

    const event = await startedEvent;
    expect(event).toMatchObject({
      appointmentId,
      consultationId: body.consultationId,
      doctorId,
    });
    expect(new Date(event.startedAt).getTime()).not.toBeNaN();

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true, patientId: true, doctorId: true },
    });
    expect(appointment?.status).toBe('in_progress');
    expect(appointment?.patientId).toBe(patientId);
  });

  it('rejects a second start with 409 CONSULTATION_EXISTS', () => {
    return request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/consultations/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body).toMatchObject({
          error: 'CONSULTATION_EXISTS',
        });
      });
  });

  it('forbids a patient from starting a consultation', () => {
    return request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/consultations/start`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('returns the consultation to a participant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const body = response.body as ConsultationDto;
    expect(body).toMatchObject({
      id: consultationId,
      appointmentId,
      status: 'active',
      endedAt: null,
    });
  });

  it('lists the consultation in the patient history', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/consultations/mine')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const items = response.body as ConsultationHistoryItemDto[];
    const item = items.find((entry) => entry.consultationId === consultationId);
    expect(item).toBeDefined();
    expect(item).toMatchObject({
      consultationId,
      appointmentId,
      diagnosis: null,
      doctor: { id: doctorId, role: 'doctor' },
    });
  });

  it('ends the consultation and emits consultation.ended', async () => {
    const joined = waitFor(patientSocket, 'room.joined');
    patientSocket.emit('room.join', { appointmentId });
    await joined;

    const endedEvent = waitFor(patientSocket, 'consultation.ended');
    const response = await request(app.getHttpServer())
      .post(`/api/consultations/${consultationId}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const body = response.body as EndConsultationResponseDto;
    expect(body).toMatchObject({
      consultationId,
      appointmentId,
      status: 'ended',
    });
    expect(new Date(body.endedAt).getTime()).not.toBeNaN();

    const event = await endedEvent;
    expect(event).toMatchObject({
      appointmentId,
      consultationId,
    });
    expect(new Date(event.endedAt).getTime()).not.toBeNaN();

    const appointment = await request(app.getHttpServer())
      .get(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect((appointment.body as AppointmentDto).status).toBe('completed');

    const calendar = await request(app.getHttpServer())
      .get('/api/appointments/calendar')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    const entry = (calendar.body as CalendarEntryDto[]).find(
      (item) => item.appointmentId === appointmentId,
    );
    expect(entry?.status).toBe('completed');
  });

  it('rejects ending the consultation a second time with 409', () => {
    return request(app.getHttpServer())
      .post(`/api/consultations/${consultationId}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body).toMatchObject({
          error: 'CONSULTATION_NOT_ACTIVE',
        });
      });
  });
});
