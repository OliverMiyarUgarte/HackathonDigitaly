import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AuthResponseDto,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@telemed/service-contracts';
import type { Server } from 'node:http';
import { io, type Socket as IoSocket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
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
const PATIENT_EMAIL = 'paciente@digitaly.health';
const PATIENT_TWO_EMAIL = 'paciente2@digitaly.health';
const DOCTOR_EMAIL = 'medico@digitaly.health';
const CONFIRMED_APPOINTMENT_ID = 'a0000000-0000-4000-8000-000000000002';
const OFFER_SDP = 'fake-offer-sdp-marker-12345';
const ANSWER_SDP = 'fake-answer-sdp-marker-67890';

describe('Realtime (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port = 0;
  const startedAt = new Date();
  const sockets: ClientSocket[] = [];

  let patientToken = '';
  let patientTwoToken = '';
  let doctorToken = '';
  let patientId = '';
  let doctorId = '';

  const logged: string[] = [];
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const login = async (email: string): Promise<AuthResponseDto> => {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    });
    if (!response.ok) {
      throw new Error(`Login failed for ${email}`);
    }
    const body: unknown = await response.json();
    return body as AuthResponseDto;
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
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((...args: unknown[]) => {
        logged.push(JSON.stringify(args));
      });
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((...args: unknown[]) => {
        logged.push(JSON.stringify(args));
      });
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((...args: unknown[]) => {
        logged.push(JSON.stringify(args));
      });

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
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const address = httpServer.address();
    port = typeof address === 'object' && address !== null ? address.port : 0;

    prisma = app.get(PrismaService);

    const patient = await login(PATIENT_EMAIL);
    const patientTwo = await login(PATIENT_TWO_EMAIL);
    const doctor = await login(DOCTOR_EMAIL);

    patientToken = patient.tokens.accessToken;
    patientTwoToken = patientTwo.tokens.accessToken;
    doctorToken = doctor.tokens.accessToken;
    patientId = patient.user.id;
    doctorId = doctor.user.id;
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }

    if (prisma) {
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
    }

    if (app) {
      await app.close();
    }

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects a socket that presents no access token', async () => {
    const socket = io(`http://127.0.0.1:${port}/realtime`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      autoConnect: false,
    }) as unknown as ClientSocket;
    sockets.push(socket);

    const disconnected = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('socket was not disconnected')),
        5000,
      );
      socket.on('disconnect', (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });

    socket.connect();

    await expect(disconnected).resolves.toBeDefined();
  });

  it('lets the patient join the room with ICE servers', async () => {
    const patient = await connectSocket(patientToken);
    const joined = waitFor(patient, 'room.joined');

    patient.emit('room.join', { appointmentId: CONFIRMED_APPOINTMENT_ID });
    const payload = await joined;

    expect(payload.appointmentId).toBe(CONFIRMED_APPOINTMENT_ID);
    expect(payload.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: patientId, role: 'patient' }),
      ]),
    );
    expect(payload.iceServers.length).toBeGreaterThan(0);
    expect(payload.iceServers[0].urls[0]).toContain('stun:');
  });

  it('broadcasts participant.joined to the first socket when the doctor joins', async () => {
    const patient = sockets[1];
    const doctorJoined = waitFor(patient, 'participant.joined');

    const doctor = await connectSocket(doctorToken);
    const joined = waitFor(doctor, 'room.joined');
    doctor.emit('room.join', { appointmentId: CONFIRMED_APPOINTMENT_ID });
    await joined;

    const payload = await doctorJoined;
    expect(payload).toMatchObject({
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      userId: doctorId,
      role: 'doctor',
    });
  });

  it('relays an offer from the doctor to the patient with fromUserId', async () => {
    const patient = sockets[1];
    const doctor = sockets[2];
    const offerReceived = waitFor(patient, 'webrtc.offer');

    doctor.emit('webrtc.offer', {
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      sdp: OFFER_SDP,
    });

    const payload = await offerReceived;
    expect(payload).toEqual({
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      fromUserId: doctorId,
      sdp: OFFER_SDP,
    });
  });

  it('relays an answer back to the doctor', async () => {
    const patient = sockets[1];
    const doctor = sockets[2];
    const answerReceived = waitFor(doctor, 'webrtc.answer');

    patient.emit('webrtc.answer', {
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      sdp: ANSWER_SDP,
    });

    const payload = await answerReceived;
    expect(payload).toEqual({
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      fromUserId: patientId,
      sdp: ANSWER_SDP,
    });
  });

  it('relays media.state with the sender id', async () => {
    const patient = sockets[1];
    const doctor = sockets[2];
    const mediaReceived = waitFor(patient, 'media.state');

    doctor.emit('media.state', {
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      mic: false,
      camera: true,
    });

    const payload = await mediaReceived;
    expect(payload).toEqual({
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      userId: doctorId,
      mic: false,
      camera: true,
    });
  });

  it('broadcasts participant.left when the patient disconnects', async () => {
    const patient = sockets[1];
    const doctor = sockets[2];
    const patientLeft = waitFor(doctor, 'participant.left');

    patient.disconnect();

    const payload = await patientLeft;
    expect(payload).toMatchObject({
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      userId: patientId,
      role: 'patient',
    });
  });

  it('rejects a non-participant with a generic room.error', async () => {
    const outsider = await connectSocket(patientTwoToken);
    const errorReceived = waitFor(outsider, 'room.error');

    outsider.emit('room.join', { appointmentId: CONFIRMED_APPOINTMENT_ID });

    const payload = await errorReceived;
    expect(payload).toEqual({ code: 'FORBIDDEN', message: 'Access denied' });
  });

  it('never logs access tokens or SDP at any level', () => {
    const serialized = logged.join('\n');
    expect(serialized).not.toContain(patientToken);
    expect(serialized).not.toContain(doctorToken);
    expect(serialized).not.toContain(patientTwoToken);
    expect(serialized).not.toContain(OFFER_SDP);
    expect(serialized).not.toContain(ANSWER_SDP);
    expect(logged.length).toBeGreaterThan(0);
  });
});
