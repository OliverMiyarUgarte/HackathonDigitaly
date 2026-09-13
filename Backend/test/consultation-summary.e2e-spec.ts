import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AppointmentDto,
  AuthResponseDto,
  ClientToServerEvents,
  ConsultationSummaryDto,
  ServerToClientEvents,
  SlotDto,
  StartConsultationResponseDto,
} from '@telemed/service-contracts';
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import { io, type Socket as IoSocket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  WebSocketServer,
  type RawData,
  type WebSocket as WsServerSocket,
} from 'ws';
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
const DOCTOR_EMAIL = 'medico@digitaly.health';
const E2E_INTERNAL_TOKEN = 'e2e-ai-internal-token';
const SUMMARY_TIMEOUT_MS = 5000;

const DOCTOR_SUMMARY = 'Resumo clinico gerado pela IA';
const PATIENT_SUMMARY = 'Resumo do paciente gerado pela IA';

describe('Consultation summary (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let port = 0;
  const startedAt = new Date();
  const sentCodes: { to: string; code: string }[] = [];
  const createdAppointmentIds: string[] = [];
  const createdConsultationIds: string[] = [];
  const sockets: ClientSocket[] = [];

  let fakeHttpBase = '';
  let fakeWsBase = '';
  let fakeServer: HttpServer | null = null;
  let fakeWss: WebSocketServer | null = null;
  let fakeSessionCounter = 0;
  const fakeSockets: WsServerSocket[] = [];

  let originalAiServiceUrl: string | undefined;
  let originalAiBaseUrl: string | undefined;
  let originalAiWsUrl: string | undefined;
  let originalAiToken: string | undefined;

  let doctorToken = '';
  let doctorId = '';
  let patientToken = '';
  let patientId = '';
  let unrelatedPatientToken = '';
  let unrelatedPatientId = '';
  let appointmentId = '';
  let consultationId = '';
  let doctorSocket: ClientSocket;
  let patientSocket: ClientSocket;

  const mailStub = {
    sendValidationCode: jest.fn((to: string, code: string): Promise<void> => {
      sentCodes.push({ to, code });
      return Promise.resolve();
    }),
  };

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  const rawToText = (raw: RawData): string => {
    if (Buffer.isBuffer(raw)) {
      return raw.toString('utf8');
    }
    if (Array.isArray(raw)) {
      return Buffer.concat(raw).toString('utf8');
    }
    return Buffer.from(raw).toString('utf8');
  };

  const handleCreateSession = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    if (req.headers['x-internal-token'] !== E2E_INTERNAL_TOKEN) {
      res.statusCode = 401;
      res.end();
      return;
    }
    await readBody(req);
    fakeSessionCounter += 1;
    res.setHeader('content-type', 'application/json');
    res.statusCode = 201;
    res.end(
      JSON.stringify({
        sessionId: `fake-summary-session-${fakeSessionCounter}`,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    );
  };

  const startFakePythonService = async (): Promise<void> => {
    fakeServer = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/sessions') {
        void handleCreateSession(req, res);
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    fakeWss = new WebSocketServer({ server: fakeServer });
    fakeWss.on('connection', (socket: WsServerSocket) => {
      fakeSockets.push(socket);
      socket.on('message', (raw: RawData) => {
        let type = '';
        try {
          type = (JSON.parse(rawToText(raw)) as { type?: string }).type ?? '';
        } catch {
          type = '';
        }
        if (type === 'audio.end') {
          socket.send(
            JSON.stringify({
              type: 'summary.ready',
              doctorSummary: DOCTOR_SUMMARY,
              patientSummary: PATIENT_SUMMARY,
              at: new Date().toISOString(),
            }),
          );
        }
        if (type === 'session.close') {
          socket.close();
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      if (!fakeServer) {
        reject(new Error('Fake AI server is not initialized'));
        return;
      }
      fakeServer.once('error', reject);
      fakeServer.listen(0, '127.0.0.1', () => {
        fakeServer?.off('error', reject);
        resolve();
      });
    });

    const address = fakeServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Fake AI server has no port');
    }
    fakeHttpBase = `http://127.0.0.1:${address.port}`;
    fakeWsBase = `ws://127.0.0.1:${address.port}`;
  };

  const stopFakePythonService = async (): Promise<void> => {
    for (const socket of fakeSockets) {
      socket.terminate();
    }
    fakeSockets.length = 0;
    if (fakeWss) {
      await new Promise<void>((resolve) => {
        fakeWss?.close(() => resolve());
      });
      fakeWss = null;
    }
    if (fakeServer) {
      await new Promise<void>((resolve) => {
        fakeServer?.close(() => resolve());
      });
      fakeServer = null;
    }
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

  const waitForStatus = (status: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        doctorSocket.off('ai.status', handler);
        reject(new Error(`Timed out waiting for ai.status ${status}`));
      }, 5000);
      const handler = (
        payload: Parameters<ServerToClientEvents['ai.status']>[0],
      ): void => {
        if (payload.status !== status) {
          return;
        }
        clearTimeout(timer);
        doctorSocket.off('ai.status', handler);
        resolve();
      };
      doctorSocket.on('ai.status', handler);
    });

  const waitForPersistedSummary = async (): Promise<{
    doctorSummary: string | null;
    patientSummary: string | null;
    summaryGeneratedAt: Date | null;
  }> => {
    const deadline = Date.now() + SUMMARY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const row = await prisma.consultation.findUnique({
        where: { id: consultationId },
        select: {
          doctorSummary: true,
          patientSummary: true,
          summaryGeneratedAt: true,
        },
      });
      if (
        row &&
        row.doctorSummary !== null &&
        row.patientSummary !== null &&
        row.summaryGeneratedAt !== null
      ) {
        return {
          doctorSummary: row.doctorSummary,
          patientSummary: row.patientSummary,
          summaryGeneratedAt: row.summaryGeneratedAt,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for the persisted summary');
  };

  const login = async (email: string): Promise<AuthResponseDto> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: DEMO_PASSWORD })
      .expect(200);
    return response.body as AuthResponseDto;
  };

  const registerPatient = async (prefix: string): Promise<AuthResponseDto> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: `E2E ${prefix} Patient`,
        email: `${prefix}+${Date.now()}@digitaly.health`,
        password: DEMO_PASSWORD,
        role: 'patient',
      })
      .expect(201);
    return response.body as AuthResponseDto;
  };

  beforeAll(async () => {
    originalAiServiceUrl = process.env.AI_SERVICE_URL;
    originalAiBaseUrl = process.env.AI_BASE_URL;
    originalAiWsUrl = process.env.AI_WS_URL;
    originalAiToken = process.env.AI_INTERNAL_TOKEN;

    await startFakePythonService();
    process.env.AI_SERVICE_URL = fakeHttpBase;
    process.env.AI_BASE_URL = fakeHttpBase;
    process.env.AI_WS_URL = fakeWsBase;
    process.env.AI_INTERNAL_TOKEN = E2E_INTERNAL_TOKEN;

    const { AppModule } = await import('../src/app.module.js');
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

    const httpServer = app.getHttpServer() as HttpServer;
    const address = httpServer.address();
    port = typeof address === 'object' && address !== null ? address.port : 0;

    prisma = app.get(PrismaService);

    const doctor = await login(DOCTOR_EMAIL);
    doctorToken = doctor.tokens.accessToken;
    doctorId = doctor.user.id;

    const patient = await registerPatient('summary-patient');
    patientToken = patient.tokens.accessToken;
    patientId = patient.user.id;

    const unrelated = await registerPatient('summary-unrelated');
    unrelatedPatientToken = unrelated.tokens.accessToken;
    unrelatedPatientId = unrelated.user.id;

    const slotsResponse = await request(app.getHttpServer())
      .get(`/api/appointments/doctors/${doctorId}/slots`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    const slots = slotsResponse.body as SlotDto[];
    const futureSlots = slots.filter(
      (slot) =>
        new Date(slot.startsAt).getTime() >
        Date.now() + 2 * 24 * 60 * 60 * 1000,
    );
    const slot = futureSlots[0] ?? slots[0];
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
    const code = sentCodes[sentCodes.length - 1]?.code;
    if (!code) {
      throw new Error('Validation code was not captured');
    }

    await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/verify-code`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ code })
      .expect(200);

    doctorSocket = await connectSocket(doctorToken);
    patientSocket = await connectSocket(patientToken);
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }

    if (prisma) {
      const resourceIds = [...createdAppointmentIds, ...createdConsultationIds];
      if (resourceIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { resourceId: { in: resourceIds } },
        });
      }
      if (createdAppointmentIds.length > 0) {
        await prisma.appointment.deleteMany({
          where: { id: { in: createdAppointmentIds } },
        });
      }
      const userIds = [patientId, unrelatedPatientId].filter(
        (id) => id.length > 0,
      );
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.refreshToken.deleteMany({
        where: { userId: doctorId, createdAt: { gte: startedAt } },
      });
    }

    if (app) {
      await app.close();
    }

    await stopFakePythonService();

    restoreEnv('AI_SERVICE_URL', originalAiServiceUrl);
    restoreEnv('AI_BASE_URL', originalAiBaseUrl);
    restoreEnv('AI_WS_URL', originalAiWsUrl);
    restoreEnv('AI_INTERNAL_TOKEN', originalAiToken);
  });

  it('persists the summary and serves it to both participants but not to others', async () => {
    const patientSummaryEvent = waitFor(patientSocket, 'consultation.summary');
    const ready = waitForStatus('ready');

    const startResponse = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentId}/consultations/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    const start = startResponse.body as StartConsultationResponseDto;
    consultationId = start.consultationId;
    createdConsultationIds.push(consultationId);
    expect(start).toMatchObject({
      appointmentId,
      status: 'active',
    });

    await ready;

    await request(app.getHttpServer())
      .post(`/api/consultations/${consultationId}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    const persisted = await waitForPersistedSummary();
    expect(persisted.doctorSummary).toBe(DOCTOR_SUMMARY);
    expect(persisted.patientSummary).toBe(PATIENT_SUMMARY);
    expect(persisted.summaryGeneratedAt).toBeInstanceOf(Date);

    const event = await patientSummaryEvent;
    expect(event).toMatchObject({
      consultationId,
      doctorSummary: DOCTOR_SUMMARY,
      patientSummary: PATIENT_SUMMARY,
    });
    expect(new Date(event.generatedAt).getTime()).not.toBeNaN();

    const doctorResponse = await request(app.getHttpServer())
      .get(`/api/consultations/${consultationId}/summary`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    const doctorSummary = doctorResponse.body as ConsultationSummaryDto;
    expect(doctorSummary).toMatchObject({
      consultationId,
      doctorSummary: DOCTOR_SUMMARY,
      patientSummary: PATIENT_SUMMARY,
    });
    expect(new Date(doctorSummary.generatedAt).getTime()).not.toBeNaN();

    const patientResponse = await request(app.getHttpServer())
      .get(`/api/consultations/${consultationId}/summary`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect(patientResponse.body as ConsultationSummaryDto).toMatchObject({
      consultationId,
      doctorSummary: DOCTOR_SUMMARY,
      patientSummary: PATIENT_SUMMARY,
    });

    await request(app.getHttpServer())
      .get(`/api/consultations/${consultationId}/summary`)
      .set('Authorization', `Bearer ${unrelatedPatientToken}`)
      .expect((response) => {
        expect([403, 404]).toContain(response.status);
      });
  });

  it('returns 404 for a consultation that does not exist', async () => {
    const unknownId = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer())
      .get(`/api/consultations/${unknownId}/summary`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(404);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
