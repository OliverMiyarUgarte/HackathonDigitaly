import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ClientToServerEvents,
  IceServerDto,
  InterServerEvents,
  ParticipantDto,
  ServerToClientEvents,
  SocketData,
  UserRole,
} from '@telemed/service-contracts';
import type { Namespace } from 'socket.io';
import type { AudioFrameHandler } from './audio-frame-handler';

export type RealtimeServer = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface PresenceEntry {
  role: UserRole;
  joinedAt: string;
  socketIds: Set<string>;
}

export interface ParticipantLeft {
  appointmentId: string;
  participant: ParticipantDto;
}

const APPOINTMENT_ROOM_PREFIX = 'appointment:';
const USER_ROOM_PREFIX = 'user:';
const DEFAULT_STUN_URL = 'stun:stun.l.google.com:19302';

@Injectable()
export class RealtimeService {
  private server: RealtimeServer | null = null;
  private audioFrameHandler: AudioFrameHandler | null = null;
  private readonly presence = new Map<string, Map<string, PresenceEntry>>();
  private readonly socketMemberships = new Map<string, Set<string>>();

  constructor(private readonly configService: ConfigService) {}

  setServer(server: RealtimeServer): void {
    this.server = server;
  }

  setAudioFrameHandler(handler: AudioFrameHandler | null): void {
    this.audioFrameHandler = handler;
  }

  getAudioFrameHandler(): AudioFrameHandler | null {
    return this.audioFrameHandler;
  }

  appointmentRoom(appointmentId: string): string {
    return `${APPOINTMENT_ROOM_PREFIX}${appointmentId}`;
  }

  userRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId}`;
  }

  addParticipant(
    appointmentId: string,
    userId: string,
    role: UserRole,
    socketId: string,
  ): ParticipantDto {
    let room = this.presence.get(appointmentId);
    if (!room) {
      room = new Map<string, PresenceEntry>();
      this.presence.set(appointmentId, room);
    }

    const existing = room.get(userId);
    const entry: PresenceEntry = existing ?? {
      role,
      joinedAt: new Date().toISOString(),
      socketIds: new Set(),
    };
    entry.socketIds.add(socketId);
    room.set(userId, entry);

    this.trackSocket(socketId, appointmentId);

    return { userId, role: entry.role, joinedAt: entry.joinedAt };
  }

  removeFromAppointment(
    appointmentId: string,
    socketId: string,
  ): ParticipantDto | null {
    this.untrackSocket(socketId, appointmentId);

    const room = this.presence.get(appointmentId);
    if (!room) {
      return null;
    }

    for (const [userId, entry] of room.entries()) {
      if (!entry.socketIds.has(socketId)) {
        continue;
      }
      entry.socketIds.delete(socketId);
      if (entry.socketIds.size > 0) {
        return null;
      }
      room.delete(userId);
      if (room.size === 0) {
        this.presence.delete(appointmentId);
      }
      return { userId, role: entry.role, joinedAt: entry.joinedAt };
    }

    return null;
  }

  removeSocket(socketId: string): ParticipantLeft[] {
    const memberships = this.socketMemberships.get(socketId);
    if (!memberships) {
      return [];
    }

    const left: ParticipantLeft[] = [];
    for (const appointmentId of [...memberships]) {
      const participant = this.removeFromAppointment(appointmentId, socketId);
      if (participant) {
        left.push({ appointmentId, participant });
      }
    }
    this.socketMemberships.delete(socketId);
    return left;
  }

  hasSocketMembership(socketId: string, appointmentId: string): boolean {
    return this.socketMemberships.get(socketId)?.has(appointmentId) ?? false;
  }

  getParticipants(appointmentId: string): ParticipantDto[] {
    const room = this.presence.get(appointmentId);
    if (!room) {
      return [];
    }
    return [...room.entries()].map(([userId, entry]) => ({
      userId,
      role: entry.role,
      joinedAt: entry.joinedAt,
    }));
  }

  buildIceServers(): IceServerDto[] {
    const iceServers: IceServerDto[] = [];

    const stunUrls = this.parseUrlList(
      this.configService.get<string>('STUN_URLS'),
    );
    iceServers.push({
      urls: stunUrls.length > 0 ? stunUrls : [DEFAULT_STUN_URL],
    });

    const turnUrls = this.parseUrlList(
      this.configService.get<string>('TURN_URLS'),
    );
    if (turnUrls.length > 0) {
      const turnServer: IceServerDto = { urls: turnUrls };
      const username = this.configService.get<string>('TURN_USERNAME');
      const credential = this.configService.get<string>('TURN_CREDENTIAL');
      if (username) {
        turnServer.username = username;
      }
      if (credential) {
        turnServer.credential = credential;
      }
      iceServers.push(turnServer);
    }

    return iceServers;
  }

  emitToAppointment<K extends keyof ServerToClientEvents>(
    appointmentId: string,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    this.emitToRoom(this.appointmentRoom(appointmentId), event, payload);
  }

  emitToUser<K extends keyof ServerToClientEvents>(
    userId: string,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    this.emitToRoom(this.userRoom(userId), event, payload);
  }

  private emitToRoom<K extends keyof ServerToClientEvents>(
    room: string,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    if (!this.server) {
      return;
    }
    const operator = this.server.to(room) as unknown as {
      emit: (event: K, payload: Parameters<ServerToClientEvents[K]>[0]) => void;
    };
    operator.emit(event, payload);
  }

  private trackSocket(socketId: string, appointmentId: string): void {
    let memberships = this.socketMemberships.get(socketId);
    if (!memberships) {
      memberships = new Set<string>();
      this.socketMemberships.set(socketId, memberships);
    }
    memberships.add(appointmentId);
  }

  private untrackSocket(socketId: string, appointmentId: string): void {
    const memberships = this.socketMemberships.get(socketId);
    if (!memberships) {
      return;
    }
    memberships.delete(appointmentId);
    if (memberships.size === 0) {
      this.socketMemberships.delete(socketId);
    }
  }

  private parseUrlList(value: string | undefined): string[] {
    if (!value) {
      return [];
    }
    return value
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
  }
}
