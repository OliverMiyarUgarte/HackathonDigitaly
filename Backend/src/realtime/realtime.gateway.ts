import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type {
  ClientToServerEvents,
  ErrorCode,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
  UserRole,
} from '@telemed/service-contracts';
import type { Namespace, Socket } from 'socket.io';
import { AppointmentAccessService } from '../appointments/appointment-access.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { RealtimeService } from './realtime.service';

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type RealtimeNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface RelayOffer {
  appointmentId: string;
  sdp: string;
}

interface RelayIce {
  appointmentId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

interface RelayMediaState {
  appointmentId: string;
  mic: boolean;
  camera: boolean;
}

const WEB_ORIGIN_FALLBACK = 'http://localhost:3000';

function resolveAllowedOrigins(): string[] {
  const raw = process.env.WEB_ORIGIN ?? WEB_ORIGIN_FALLBACK;
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : [WEB_ORIGIN_FALLBACK];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'doctor' || value === 'patient';
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.sub === 'string' &&
    value.sub.length > 0 &&
    isUserRole(value.role)
  );
}

@WebSocketGateway({
  namespace: 'realtime',
  cors: {
    origin: (origin, callback) => {
      const allowed = resolveAllowedOrigins();
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'));
    },
    credentials: true,
  },
})
export class RealtimeGateway
  implements
    OnGatewayInit<RealtimeNamespace>,
    OnGatewayConnection<RealtimeSocket>,
    OnGatewayDisconnect<RealtimeSocket>
{
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly accessService: AppointmentAccessService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: RealtimeNamespace): void {
    this.realtimeService.setServer(server);
  }

  async handleConnection(client: RealtimeSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.reject(client);
      return;
    }

    try {
      const payload: unknown = await this.jwtService.verifyAsync(token);
      if (!isAuthenticatedUser(payload)) {
        this.reject(client);
        return;
      }
      client.data.user = { sub: payload.sub, role: payload.role };
      await client.join(this.realtimeService.userRoom(payload.sub));
    } catch {
      this.reject(client);
    }
  }

  handleDisconnect(client: RealtimeSocket): void {
    const left = this.realtimeService.removeSocket(client.id);
    for (const { appointmentId, participant } of left) {
      this.realtimeService.emitToAppointment(
        appointmentId,
        'participant.left',
        {
          appointmentId,
          userId: participant.userId,
          role: participant.role,
          leftAt: new Date().toISOString(),
        },
      );
    }
  }

  @SubscribeMessage('room.join')
  async handleRoomJoin(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) {
      this.emitRoomError(client, 'UNAUTHENTICATED', 'Authentication required');
      return;
    }

    const appointmentId = this.parseAppointmentId(payload);
    if (!appointmentId) {
      this.emitRoomError(client, 'VALIDATION_FAILED', 'Invalid payload');
      return;
    }

    try {
      await this.accessService.assertAppointmentAccess(user, appointmentId);
    } catch {
      this.emitRoomError(client, 'FORBIDDEN', 'Access denied');
      return;
    }

    const room = this.realtimeService.appointmentRoom(appointmentId);
    await client.join(room);
    await client.join(this.realtimeService.userRoom(user.sub));

    const participant = this.realtimeService.addParticipant(
      appointmentId,
      user.sub,
      user.role,
      client.id,
    );

    client.emit('room.joined', {
      appointmentId,
      participants: this.realtimeService.getParticipants(appointmentId),
      iceServers: this.realtimeService.buildIceServers(),
    });

    client.to(room).emit('participant.joined', {
      appointmentId,
      userId: participant.userId,
      role: participant.role,
      joinedAt: participant.joinedAt ?? new Date().toISOString(),
    });
  }

  @SubscribeMessage('room.leave')
  async handleRoomLeave(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    if (!client.data.user) {
      this.emitRoomError(client, 'UNAUTHENTICATED', 'Authentication required');
      return;
    }

    const appointmentId = this.parseAppointmentId(payload);
    if (!appointmentId) {
      this.emitRoomError(client, 'VALIDATION_FAILED', 'Invalid payload');
      return;
    }

    const room = this.realtimeService.appointmentRoom(appointmentId);
    const participant = this.realtimeService.removeFromAppointment(
      appointmentId,
      client.id,
    );
    await client.leave(room);

    if (participant) {
      this.realtimeService.emitToAppointment(
        appointmentId,
        'participant.left',
        {
          appointmentId,
          userId: participant.userId,
          role: participant.role,
          leftAt: new Date().toISOString(),
        },
      );
    }
  }

  @SubscribeMessage('webrtc.offer')
  handleWebrtcOffer(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const relay = this.parseOffer(payload);
    if (!relay || !this.isInRoom(client, relay.appointmentId)) {
      return;
    }
    client
      .to(this.realtimeService.appointmentRoom(relay.appointmentId))
      .emit('webrtc.offer', {
        appointmentId: relay.appointmentId,
        fromUserId: client.data.user.sub,
        sdp: relay.sdp,
      });
  }

  @SubscribeMessage('webrtc.answer')
  handleWebrtcAnswer(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const relay = this.parseOffer(payload);
    if (!relay || !this.isInRoom(client, relay.appointmentId)) {
      return;
    }
    client
      .to(this.realtimeService.appointmentRoom(relay.appointmentId))
      .emit('webrtc.answer', {
        appointmentId: relay.appointmentId,
        fromUserId: client.data.user.sub,
        sdp: relay.sdp,
      });
  }

  @SubscribeMessage('webrtc.ice')
  handleWebrtcIce(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const relay = this.parseIce(payload);
    if (!relay || !this.isInRoom(client, relay.appointmentId)) {
      return;
    }
    client
      .to(this.realtimeService.appointmentRoom(relay.appointmentId))
      .emit('webrtc.ice', {
        appointmentId: relay.appointmentId,
        fromUserId: client.data.user.sub,
        candidate: relay.candidate,
        sdpMid: relay.sdpMid,
        sdpMLineIndex: relay.sdpMLineIndex,
      });
  }

  @SubscribeMessage('media.state')
  handleMediaState(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): void {
    const relay = this.parseMediaState(payload);
    if (!relay || !this.isInRoom(client, relay.appointmentId)) {
      return;
    }
    client
      .to(this.realtimeService.appointmentRoom(relay.appointmentId))
      .emit('media.state', {
        appointmentId: relay.appointmentId,
        userId: client.data.user.sub,
        mic: relay.mic,
        camera: relay.camera,
      });
  }

  private isInRoom(client: RealtimeSocket, appointmentId: string): boolean {
    if (!client.data.user) {
      return false;
    }
    return client.rooms.has(
      this.realtimeService.appointmentRoom(appointmentId),
    );
  }

  private extractToken(client: RealtimeSocket): string | null {
    const auth: unknown = client.handshake.auth;
    if (
      isRecord(auth) &&
      typeof auth.token === 'string' &&
      auth.token.length > 0
    ) {
      return auth.token;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      if (token.length > 0) {
        return token;
      }
    }

    return null;
  }

  private reject(client: RealtimeSocket): void {
    this.logger.warn('Rejected realtime connection with invalid credentials');
    client.disconnect(true);
  }

  private emitRoomError(
    client: RealtimeSocket,
    code: ErrorCode,
    message: string,
  ): void {
    client.emit('room.error', { code, message });
  }

  private parseAppointmentId(payload: unknown): string | null {
    if (!isRecord(payload)) {
      return null;
    }
    const appointmentId = payload.appointmentId;
    if (typeof appointmentId !== 'string' || appointmentId.length === 0) {
      return null;
    }
    return appointmentId;
  }

  private parseOffer(payload: unknown): RelayOffer | null {
    const appointmentId = this.parseAppointmentId(payload);
    if (!appointmentId || !isRecord(payload)) {
      return null;
    }
    const sdp = payload.sdp;
    if (typeof sdp !== 'string' || sdp.length === 0) {
      return null;
    }
    return { appointmentId, sdp };
  }

  private parseIce(payload: unknown): RelayIce | null {
    const appointmentId = this.parseAppointmentId(payload);
    if (!appointmentId || !isRecord(payload)) {
      return null;
    }

    const candidate = payload.candidate;
    if (typeof candidate !== 'string' || candidate.length === 0) {
      return null;
    }

    const sdpMid = payload.sdpMid;
    if (sdpMid !== null && typeof sdpMid !== 'string') {
      return null;
    }

    const sdpMLineIndex = payload.sdpMLineIndex;
    if (sdpMLineIndex !== null && typeof sdpMLineIndex !== 'number') {
      return null;
    }

    return { appointmentId, candidate, sdpMid, sdpMLineIndex };
  }

  private parseMediaState(payload: unknown): RelayMediaState | null {
    const appointmentId = this.parseAppointmentId(payload);
    if (!appointmentId || !isRecord(payload)) {
      return null;
    }

    const mic = payload.mic;
    const camera = payload.camera;
    if (typeof mic !== 'boolean' || typeof camera !== 'boolean') {
      return null;
    }

    return { appointmentId, mic, camera };
  }
}
