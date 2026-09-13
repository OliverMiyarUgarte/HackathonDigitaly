import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiClientFrame,
  AiServerFrame,
  AiSessionCreatedDto,
  CreateAiSessionRequestDto,
  FeedbackSeverity,
} from '@telemed/service-contracts';
import WebSocket from 'ws';
import type { RawData } from 'ws';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AudioChunkFrame,
  AudioEndFrame,
  AudioFrameHandler,
} from '../realtime/audio-frame-handler';
import { RealtimeService } from '../realtime/realtime.service';

const HTTP_TIMEOUT_MS = 2_000;
const WS_TIMEOUT_MS = 2_000;
const MAX_BUFFERED_FRAMES = 64;
const INTERNAL_TOKEN_HEADER = 'X-Internal-Token';
const DEFAULT_HTTP_BASE_URL = 'http://localhost:8000';

export interface OpenAiSessionInput {
  consultationId: string;
  appointmentId: string;
  doctorId?: string;
}

interface AiSessionState {
  consultationId: string;
  appointmentId: string;
  doctorId: string;
  sessionId: string | null;
  socket: WebSocket | null;
  ready: boolean;
  closed: boolean;
  buffer: AiClientFrame[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFeedbackSeverity(value: unknown): value is FeedbackSeverity {
  return value === 'info' || value === 'warning' || value === 'critical';
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const item of value as unknown[]) {
    if (typeof item !== 'string') {
      return false;
    }
  }
  return true;
}

function parseAiSessionCreated(value: unknown): AiSessionCreatedDto | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.sessionId !== 'string' || value.sessionId.length === 0) {
    return null;
  }
  if (typeof value.expiresAt !== 'string' || value.expiresAt.length === 0) {
    return null;
  }
  return { sessionId: value.sessionId, expiresAt: value.expiresAt };
}

function parseAiServerFrame(raw: string): AiServerFrame | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return null;
  }

  switch (parsed.type) {
    case 'transcript.partial':
      if (typeof parsed.text === 'string' && typeof parsed.at === 'string') {
        return { type: 'transcript.partial', text: parsed.text, at: parsed.at };
      }
      return null;
    case 'transcript.final':
      if (
        typeof parsed.segmentId === 'string' &&
        typeof parsed.text === 'string' &&
        typeof parsed.at === 'string'
      ) {
        return {
          type: 'transcript.final',
          segmentId: parsed.segmentId,
          text: parsed.text,
          at: parsed.at,
        };
      }
      return null;
    case 'copilot.feedback':
      if (
        isFeedbackSeverity(parsed.severity) &&
        typeof parsed.message === 'string' &&
        typeof parsed.at === 'string' &&
        isStringArray(parsed.tags)
      ) {
        return {
          type: 'copilot.feedback',
          severity: parsed.severity,
          message: parsed.message,
          at: parsed.at,
          tags: parsed.tags,
        };
      }
      return null;
    case 'error':
      if (
        typeof parsed.code === 'string' &&
        typeof parsed.message === 'string' &&
        typeof parsed.at === 'string'
      ) {
        return {
          type: 'error',
          code: parsed.code,
          message: parsed.message,
          at: parsed.at,
        };
      }
      return null;
    default:
      return null;
  }
}

function toText(data: RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  return Buffer.from(data).toString('utf8');
}

@Injectable()
export class AiProxyService
  implements OnModuleInit, OnModuleDestroy, AudioFrameHandler
{
  private readonly logger = new Logger(AiProxyService.name);
  private readonly sessions = new Map<string, AiSessionState>();

  constructor(
    private readonly configService: ConfigService,
    private readonly realtime: RealtimeService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.realtime.setAudioFrameHandler(this);
  }

  onModuleDestroy(): void {
    for (const consultationId of [...this.sessions.keys()]) {
      this.disposeSession(consultationId, true);
    }
    this.realtime.setAudioFrameHandler(null);
  }

  async openSession(input: OpenAiSessionInput): Promise<void> {
    const { consultationId, appointmentId } = input;
    if (this.sessions.has(consultationId)) {
      return;
    }

    const doctorId = await this.resolveDoctorId(input);
    if (!doctorId) {
      return;
    }

    const state: AiSessionState = {
      consultationId,
      appointmentId,
      doctorId,
      sessionId: null,
      socket: null,
      ready: false,
      closed: false,
      buffer: [],
    };
    this.sessions.set(consultationId, state);
    this.emitStatus(state, 'connecting');

    try {
      const created = await this.createRemoteSession({
        consultationId,
        appointmentId,
      });
      state.sessionId = created.sessionId;
      await this.connectSocket(state);
      state.ready = true;
      this.flushBuffer(state);
      this.emitStatus(state, 'ready');
    } catch {
      this.logger.warn('AI session unavailable');
      this.emitStatus(state, 'unavailable');
      this.disposeSession(consultationId, true);
    }
  }

  closeSession(consultationId: string): void {
    if (!this.sessions.has(consultationId)) {
      return;
    }
    this.disposeSession(consultationId, false);
  }

  handleAudioChunk(user: AuthenticatedUser, frame: AudioChunkFrame): void {
    const state = this.getAuthorizedSession(user, frame.consultationId);
    if (!state) {
      return;
    }
    this.sendFrame(state, {
      type: 'audio.chunk',
      seq: frame.seq,
      data: frame.data,
      encoding: frame.encoding,
      sampleRate: frame.sampleRate,
      channels: frame.channels,
    });
  }

  handleAudioEnd(user: AuthenticatedUser, frame: AudioEndFrame): void {
    const state = this.getAuthorizedSession(user, frame.consultationId);
    if (!state) {
      return;
    }
    this.sendFrame(state, { type: 'audio.end', seq: frame.seq });
  }

  private getAuthorizedSession(
    user: AuthenticatedUser,
    consultationId: string,
  ): AiSessionState | null {
    const state = this.sessions.get(consultationId);
    if (!state || state.closed) {
      return null;
    }
    if (user.role !== 'doctor' || user.sub !== state.doctorId) {
      return null;
    }
    return state;
  }

  private async resolveDoctorId(
    input: OpenAiSessionInput,
  ): Promise<string | null> {
    if (input.doctorId && input.doctorId.length > 0) {
      return input.doctorId;
    }
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: { doctorId: true },
      });
      return appointment?.doctorId ?? null;
    } catch {
      return null;
    }
  }

  private async createRemoteSession(input: {
    consultationId: string;
    appointmentId: string;
  }): Promise<AiSessionCreatedDto> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.httpBaseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [INTERNAL_TOKEN_HEADER]: this.internalToken,
        },
        body: JSON.stringify({
          consultationId: input.consultationId,
          appointmentId: input.appointmentId,
          language: 'pt-BR',
        } satisfies CreateAiSessionRequestDto),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('AI session creation failed');
      }
      const created = parseAiSessionCreated(await response.json());
      if (!created) {
        throw new Error('AI session creation response invalid');
      }
      return created;
    } finally {
      clearTimeout(timer);
    }
  }

  private connectSocket(state: AiSessionState): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sessionId = state.sessionId;
      if (!sessionId) {
        reject(new Error('Missing AI session id'));
        return;
      }

      const socket = new WebSocket(
        `${this.wsBaseUrl}/sessions/${encodeURIComponent(sessionId)}/audio`,
        { headers: { [INTERNAL_TOKEN_HEADER]: this.internalToken } },
      );
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        socket.terminate();
        reject(new Error('AI socket timeout'));
      }, WS_TIMEOUT_MS);

      socket.on('open', () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        state.socket = socket;
        resolve();
      });

      socket.on('message', (data: RawData) => {
        this.handleServerMessage(state, data);
      });

      socket.on('error', () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        socket.terminate();
        reject(new Error('AI socket error'));
      });

      socket.on('close', () => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new Error('AI socket closed'));
          return;
        }
        state.socket = null;
        state.ready = false;
        if (!state.closed) {
          this.emitStatus(state, 'unavailable');
        }
      });
    });
  }

  private handleServerMessage(state: AiSessionState, data: RawData): void {
    const frame = parseAiServerFrame(toText(data));
    if (!frame) {
      return;
    }

    switch (frame.type) {
      case 'transcript.partial':
        this.realtime.emitToUser(state.doctorId, 'transcript.partial', {
          consultationId: state.consultationId,
          text: frame.text,
          at: frame.at,
        });
        return;
      case 'transcript.final':
        this.realtime.emitToUser(state.doctorId, 'transcript.final', {
          consultationId: state.consultationId,
          segmentId: frame.segmentId,
          text: frame.text,
          at: frame.at,
        });
        return;
      case 'copilot.feedback':
        this.realtime.emitToUser(state.doctorId, 'copilot.feedback', {
          consultationId: state.consultationId,
          severity: frame.severity,
          message: frame.message,
          at: frame.at,
          tags: frame.tags,
        });
        return;
      case 'error':
        this.emitStatus(state, 'unavailable');
        this.closeSession(state.consultationId);
        return;
      default:
        return;
    }
  }

  private emitStatus(
    state: AiSessionState,
    status: 'connecting' | 'ready' | 'unavailable',
  ): void {
    this.realtime.emitToUser(state.doctorId, 'ai.status', {
      consultationId: state.consultationId,
      status,
    });
  }

  private sendFrame(state: AiSessionState, frame: AiClientFrame): void {
    const socket = state.socket;
    if (state.ready && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame));
      return;
    }
    state.buffer.push(frame);
    if (state.buffer.length > MAX_BUFFERED_FRAMES) {
      state.buffer.shift();
    }
  }

  private flushBuffer(state: AiSessionState): void {
    const socket = state.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const pending = state.buffer;
    state.buffer = [];
    for (const frame of pending) {
      socket.send(JSON.stringify(frame));
    }
  }

  private disposeSession(consultationId: string, terminate: boolean): void {
    const state = this.sessions.get(consultationId);
    if (!state) {
      return;
    }

    state.closed = true;
    state.ready = false;
    state.buffer = [];
    const socket = state.socket;
    state.socket = null;
    this.sessions.delete(consultationId);

    if (!socket) {
      return;
    }
    if (terminate || socket.readyState !== WebSocket.OPEN) {
      socket.terminate();
      return;
    }
    try {
      socket.send(
        JSON.stringify({ type: 'session.close' } satisfies AiClientFrame),
      );
    } catch {
      socket.terminate();
      return;
    }
    socket.close();
  }

  private get internalToken(): string {
    return this.configService.get<string>('AI_INTERNAL_TOKEN') ?? '';
  }

  private get httpBaseUrl(): string {
    const explicit = this.configService.get<string>('AI_BASE_URL');
    if (explicit && explicit.length > 0) {
      return explicit.replace(/\/+$/, '');
    }
    const base =
      this.configService.get<string>('AI_SERVICE_URL') ?? DEFAULT_HTTP_BASE_URL;
    return base.replace(/\/+$/, '');
  }

  private get wsBaseUrl(): string {
    const explicit = this.configService.get<string>('AI_WS_URL');
    if (explicit && explicit.length > 0) {
      return explicit.replace(/\/+$/, '');
    }
    const url = new URL(this.httpBaseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString().replace(/\/+$/, '');
  }
}
