import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AppointmentDto,
  AuthResponseDto,
  ClientToServerEvents,
  EndConsultationResponseDto,
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

interface FakeClientFrame {
  type: string;
  seq?: number;
}

interface DoctorAiEvent {
  type: string;
  payload: unknown;
}

const DEMO_PASSWORD = 'Demo@1234';
const DOCTOR_EMAIL = 'medico@digitaly.health';
const E2E_INTERNAL_TOKEN = 'e2e-ai-internal-token';

describe('AI proxy (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let port = 0;
  const startedAt = new Date();
  const sockets: ClientSocket[] = [];
  const sentCodes: { to: string; code: string }[] = [];
  const createdAppointmentIds: string[] = [];

  let fakeHttpBase = '';
  let fakeWsBase = '';
  let fakeServer: HttpServer | null = null;
  let fakeWss: WebSocketServer | null = null;
  let fakeSessionCounter = 0;
  let fakeSocketClosed: Promise<void> | null = null;
  const fakeReceived: FakeClientFrame[] = [];
  const fakeSockets: WsServerSocket[] = [];

  let originalAiServiceUrl: string | undefined;
  let originalAiBaseUrl: string | undefined;
  let originalAiWsUrl: string | undefined;
  let originalAiToken: string | undefined;

  let doctorToken = '';
  let doctorId = '';
  let patientToken = '';
  let patientId = '';
  let freshUserId = '';
  let appointmentA = '';
  let appointmentB = '';
  let consultationA = '';
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
        sessionId: `fake-session-${fakeSessionCounter}`,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    );
  };

  const rawToText = (raw: RawData): string => {
    if (Buffer.isBuffer(raw)) {
      return raw.toString('utf8');
    }
    if (Array.isArray(raw)) {
      return Buffer.concat(raw).toString('utf8');
    }
    return Buffer.from(raw).toString('utf8');
  };

  const parseFakeFrame = (raw: string): FakeClientFrame | null => {
    try {
      const parsed = JSON.parse(raw) as { type?: unknown; seq?: unknown };
      if (typeof parsed.type !== 'string') {
        return null;
      }
      const frame: FakeClientFrame = { type: parsed.type };
      if (typeof parsed.seq === 'number') {
        frame.seq = parsed.seq;
      }
      return frame;
    } catch {
      return null;
    }
  };

  const handleFakeFrame = (
    socket: WsServerSocket,
    frame: FakeClientFrame | null,
  ): void => {
    if (!frame) {
      return;
    }
    if (frame.type === 'audio.chunk') {
      const at = new Date().toISOString();
      socket.send(
        JSON.stringify({
          type: 'transcript.partial',
          text: 'Dor no peito',
          at,
        }),
      );
      socket.send(
        JSON.stringify({
          type: 'transcript.final',
          segmentId: 'segment-1',
          text: 'Dor no peito ha duas horas',
          at,
        }),
      );
      socket.send(
        JSON.stringify({
          type: 'copilot.feedback',
          severity: 'critical',
          message: 'Considerar sindrome coronariana aguda',
          at,
          tags: ['chest-pain'],
        }),
      );
      return;
    }
    if (frame.type === 'session.close') {
      socket.close();
    }
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
      fakeSocketClosed = new Promise<void>((resolve) => {
        socket.on('close', () => resolve());
      });
      socket.on('message', (raw: RawData) => {
        const frame = parseFakeFrame(rawToText(raw));
        if (frame) {
          fakeReceived.push(frame);
        }
        handleFakeFrame(socket, frame);
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

  const waitForStatus = (
    socket: ClientSocket,
    status: string,
    timeoutMs = 5000,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off('ai.status', handler);
        reject(new Error(`Timed out waiting for ai.status ${status}`));
      }, timeoutMs);
      const handler = (
        payload: Parameters<ServerToClientEvents['ai.status']>[0],
      ): void => {
        if (payload.status !== status) {
          return;
        }
        clearTimeout(timer);
        socket.off('ai.status', handler);
        resolve();
      };
      socket.on('ai.status', handler);
    });

  const waitUntil = async (
    predicate: () => boolean,
    timeoutMs = 5000,
  ): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      if (Date.now() > deadline) {
        throw new Error('Timed out waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  const login = async (email: string): Promise<AuthResponseDto> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: DEMO_PASSWORD })
      .expect(200);
    return response.body as AuthResponseDto;
  };

  const bookAppointment = async (scheduledAt: string): Promise<string> => {
    const booking = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt })
      .expect(201);
    const appointmentId = (booking.body as AppointmentDto).id;
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

    return appointmentId;
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

    const registeredEmail = `ai-proxy+${Date.now()}@digitaly.health`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E AI Proxy Patient',
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
    const futureSlots = slots.filter(
      (slot) =>
        new Date(slot.startsAt).getTime() >
        Date.now() + 2 * 24 * 60 * 60 * 1000,
    );
    const slotA = futureSlots[0] ?? slots[0];
    const slotB = futureSlots[1] ?? slots[1];
    if (!slotA || !slotB) {
      throw new Error('Not enough bookable slots available');
    }

    appointmentA = await bookAppointment(slotA.startsAt);
    appointmentB = await bookAppointment(slotB.startsAt);

    doctorSocket = await connectSocket(doctorToken);
    patientSocket = await connectSocket(patientToken);

    const doctorJoined = waitFor(doctorSocket, 'room.joined');
    doctorSocket.emit('room.join', { appointmentId: appointmentA });
    await doctorJoined;

    const patientJoined = waitFor(patientSocket, 'room.joined');
    patientSocket.emit('room.join', { appointmentId: appointmentA });
    await patientJoined;
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

    await stopFakePythonService();

    restoreEnv('AI_SERVICE_URL', originalAiServiceUrl);
    restoreEnv('AI_BASE_URL', originalAiBaseUrl);
    restoreEnv('AI_WS_URL', originalAiWsUrl);
    restoreEnv('AI_INTERNAL_TOKEN', originalAiToken);
  });

  it('relays transcript and copilot feedback to the doctor socket only', async () => {
    expect(appointmentA).not.toBe('');
    expect(appointmentB).not.toBe('');

    const doctorStatuses: string[] = [];
    const patientAiFrames: string[] = [];
    doctorSocket.on('ai.status', (payload) =>
      doctorStatuses.push(payload.status),
    );
    for (const event of [
      'transcript.partial',
      'transcript.final',
      'copilot.feedback',
      'ai.status',
    ] as const) {
      patientSocket.on(event, () => patientAiFrames.push(event));
    }

    const ready = waitForStatus(doctorSocket, 'ready');
    const startResponse = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentA}/consultations/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    const body = startResponse.body as StartConsultationResponseDto;
    consultationA = body.consultationId;
    expect(body).toMatchObject({
      appointmentId: appointmentA,
      status: 'active',
    });

    await ready;
    expect(doctorStatuses).toContain('connecting');
    expect(doctorStatuses.indexOf('connecting')).toBeLessThan(
      doctorStatuses.indexOf('ready'),
    );

    const aiEvents: DoctorAiEvent[] = [];
    doctorSocket.on('transcript.partial', (payload) =>
      aiEvents.push({ type: 'transcript.partial', payload }),
    );
    doctorSocket.on('transcript.final', (payload) =>
      aiEvents.push({ type: 'transcript.final', payload }),
    );
    doctorSocket.on('copilot.feedback', (payload) =>
      aiEvents.push({ type: 'copilot.feedback', payload }),
    );

    doctorSocket.emit('audio.chunk', {
      consultationId: consultationA,
      seq: 1,
      data: 'AAECAwQ=',
      encoding: 'pcm_s16le',
      sampleRate: 16000,
      channels: 1,
    });

    await waitUntil(() => aiEvents.length >= 3);

    expect(aiEvents.map((event) => event.type)).toEqual([
      'transcript.partial',
      'transcript.final',
      'copilot.feedback',
    ]);

    const partial = aiEvents[0].payload as Parameters<
      ServerToClientEvents['transcript.partial']
    >[0];
    const final = aiEvents[1].payload as Parameters<
      ServerToClientEvents['transcript.final']
    >[0];
    const feedback = aiEvents[2].payload as Parameters<
      ServerToClientEvents['copilot.feedback']
    >[0];

    expect(partial).toMatchObject({
      consultationId: consultationA,
      text: 'Dor no peito',
    });
    expect(new Date(partial.at).getTime()).not.toBeNaN();
    expect(final).toMatchObject({
      consultationId: consultationA,
      segmentId: 'segment-1',
      text: 'Dor no peito ha duas horas',
    });
    expect(new Date(final.at).getTime()).not.toBeNaN();
    expect(feedback).toMatchObject({
      consultationId: consultationA,
      severity: 'critical',
      message: 'Considerar sindrome coronariana aguda',
      tags: ['chest-pain'],
    });
    expect(new Date(feedback.at).getTime()).not.toBeNaN();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(patientAiFrames).toEqual([]);
    expect(patientId).not.toBe('');

    const closed = fakeSocketClosed;
    expect(closed).not.toBeNull();
    doctorSocket.emit('audio.end', { consultationId: consultationA, seq: 2 });
    await waitUntil(() =>
      fakeReceived.some((frame) => frame.type === 'audio.end'),
    );

    expect(fakeReceived.map((frame) => frame.type)).toEqual([
      'audio.chunk',
      'audio.end',
    ]);
    expect(fakeReceived[0].seq).toBe(1);
    expect(fakeReceived[1].seq).toBe(2);

    const endResponse = await request(app.getHttpServer())
      .post(`/api/consultations/${consultationA}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    expect(endResponse.body as EndConsultationResponseDto).toMatchObject({
      consultationId: consultationA,
      appointmentId: appointmentA,
      status: 'ended',
    });

    await closed;
    expect(fakeReceived.map((frame) => frame.type)).toEqual([
      'audio.chunk',
      'audio.end',
      'session.close',
    ]);
  });

  it('keeps the consultation running with ai.status unavailable when the service is down', async () => {
    await stopFakePythonService();

    const doctorJoined = waitFor(doctorSocket, 'room.joined');
    doctorSocket.emit('room.join', { appointmentId: appointmentB });
    await doctorJoined;

    const statuses: string[] = [];
    doctorSocket.on('ai.status', (payload) => statuses.push(payload.status));
    const unavailable = waitForStatus(doctorSocket, 'unavailable');
    const transcriptHappened: string[] = [];
    for (const event of [
      'transcript.partial',
      'transcript.final',
      'copilot.feedback',
    ] as const) {
      doctorSocket.on(event, () => transcriptHappened.push(event));
    }

    const startResponse = await request(app.getHttpServer())
      .post(`/api/appointments/${appointmentB}/consultations/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    const body = startResponse.body as StartConsultationResponseDto;
    expect(body).toMatchObject({
      appointmentId: appointmentB,
      status: 'active',
    });

    await unavailable;

    expect(statuses).toContain('connecting');
    expect(statuses.indexOf('connecting')).toBeLessThan(
      statuses.indexOf('unavailable'),
    );

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(transcriptHappened).toEqual([]);

    const endResponse = await request(app.getHttpServer())
      .post(`/api/consultations/${body.consultationId}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    expect(endResponse.body as EndConsultationResponseDto).toMatchObject({
      consultationId: body.consultationId,
      appointmentId: appointmentB,
      status: 'ended',
    });
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
