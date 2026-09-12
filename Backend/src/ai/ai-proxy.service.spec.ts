import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';
import type { AudioChunkFrame } from '../realtime/audio-frame-handler';
import { AiProxyService } from './ai-proxy.service';

interface MockWebSocket {
  readyState: number;
  send: jest.Mock;
  close: jest.Mock;
  terminate: jest.Mock;
  on: (event: string, listener: (...args: unknown[]) => void) => MockWebSocket;
  emit: (event: string, ...args: unknown[]) => void;
}

jest.mock('ws', () => {
  const OPEN = 1;
  const instances: unknown[] = [];
  class MockWebSocket {
    static readonly OPEN = OPEN;
    readyState = OPEN;
    send = jest.fn();
    close = jest.fn();
    terminate = jest.fn();
    private readonly listeners = new Map<
      string,
      ((...args: unknown[]) => void)[]
    >();

    constructor() {
      instances.push(this);
    }

    on(event: string, listener: (...args: unknown[]) => void): MockWebSocket {
      const list = this.listeners.get(event) ?? [];
      list.push(listener);
      this.listeners.set(event, list);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }
  }
  return { __esModule: true, default: MockWebSocket, __instances: instances };
});

const DOCTOR_ID = 'doctor-1';
const CONSULTATION_ID = 'consultation-1';

const CHUNK: AudioChunkFrame = {
  consultationId: CONSULTATION_ID,
  seq: 3,
  data: 'AAECAw==',
  encoding: 'pcm_s16le',
  sampleRate: 16000,
  channels: 1,
};

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

function wsInstances(): MockWebSocket[] {
  const mocked = jest.requireMock<{ __instances: unknown[] }>('ws');
  return mocked.__instances as MockWebSocket[];
}

describe('AiProxyService', () => {
  let service: AiProxyService;
  let realtime: {
    setAudioFrameHandler: jest.Mock;
    emitToUser: jest.Mock;
  };
  let prisma: { appointment: { findUnique: jest.Mock } };

  beforeEach(() => {
    jest.clearAllMocks();
    wsInstances().length = 0;

    realtime = {
      setAudioFrameHandler: jest.fn(),
      emitToUser: jest.fn(),
    };
    prisma = { appointment: { findUnique: jest.fn() } };

    const config = {
      get: jest.fn((key: string): string | undefined => {
        if (key === 'AI_INTERNAL_TOKEN') {
          return 'test-token';
        }
        if (key === 'AI_SERVICE_URL') {
          return 'http://127.0.0.1:18100';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn();

    service = new AiProxyService(
      config,
      realtime as unknown as RealtimeService,
      prisma as unknown as PrismaService,
    );
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  async function openReadySession(): Promise<MockWebSocket> {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: (): Promise<unknown> =>
        Promise.resolve({
          sessionId: 'session-1',
          expiresAt: '2030-01-01T00:00:00.000Z',
        }),
    });

    const opened = service.openSession({
      consultationId: CONSULTATION_ID,
      appointmentId: 'appointment-1',
      doctorId: DOCTOR_ID,
    });
    await flushPromises();
    const socket = wsInstances()[0];
    if (!socket) {
      throw new Error('AI socket was not created');
    }
    socket.emit('open');
    await opened;
    return socket;
  }

  it('registers itself as the realtime audio frame handler', () => {
    expect(realtime.setAudioFrameHandler).toHaveBeenCalledWith(service);
  });

  it('emits unavailable and resolves when session creation fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(
      service.openSession({
        consultationId: CONSULTATION_ID,
        appointmentId: 'appointment-1',
        doctorId: DOCTOR_ID,
      }),
    ).resolves.toBeUndefined();

    expect(realtime.emitToUser).toHaveBeenCalledWith(DOCTOR_ID, 'ai.status', {
      consultationId: CONSULTATION_ID,
      status: 'connecting',
    });
    expect(realtime.emitToUser).toHaveBeenCalledWith(DOCTOR_ID, 'ai.status', {
      consultationId: CONSULTATION_ID,
      status: 'unavailable',
    });
    expect(wsInstances()).toHaveLength(0);
  });

  it('re-emits copilot.feedback to the doctor only', async () => {
    const socket = await openReadySession();

    socket.emit(
      'message',
      JSON.stringify({
        type: 'copilot.feedback',
        severity: 'warning',
        message: 'Confirmar alergia a dipirona',
        at: '2030-01-01T00:00:01.000Z',
        tags: ['allergy'],
      }),
    );

    expect(realtime.emitToUser).toHaveBeenCalledWith(
      DOCTOR_ID,
      'copilot.feedback',
      {
        consultationId: CONSULTATION_ID,
        severity: 'warning',
        message: 'Confirmar alergia a dipirona',
        at: '2030-01-01T00:00:01.000Z',
        tags: ['allergy'],
      },
    );
    const doctorCalls = (realtime.emitToUser.mock.calls as unknown[][]).filter(
      (call) => call[1] === 'copilot.feedback',
    );
    expect(doctorCalls).toHaveLength(1);
    expect(doctorCalls[0][0]).toBe(DOCTOR_ID);
  });

  it('drops audio chunks from a non-doctor or unauthorized user', async () => {
    const socket = await openReadySession();

    service.handleAudioChunk({ sub: 'patient-1', role: 'patient' }, CHUNK);
    service.handleAudioChunk({ sub: 'other-doctor', role: 'doctor' }, CHUNK);
    expect(socket.send).not.toHaveBeenCalled();

    service.handleAudioChunk({ sub: DOCTOR_ID, role: 'doctor' }, CHUNK);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'audio.chunk',
        seq: CHUNK.seq,
        data: CHUNK.data,
        encoding: CHUNK.encoding,
        sampleRate: CHUNK.sampleRate,
        channels: CHUNK.channels,
      }),
    );
  });

  it('closeSession clears the session state', async () => {
    const socket = await openReadySession();

    service.closeSession(CONSULTATION_ID);

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'session.close' }),
    );
    expect(socket.close).toHaveBeenCalledTimes(1);

    service.closeSession(CONSULTATION_ID);
    expect(socket.close).toHaveBeenCalledTimes(1);

    service.handleAudioChunk({ sub: DOCTOR_ID, role: 'doctor' }, CHUNK);
    expect(socket.send).toHaveBeenCalledTimes(1);
  });
});
