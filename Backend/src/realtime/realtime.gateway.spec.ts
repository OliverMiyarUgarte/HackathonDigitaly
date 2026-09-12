import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { AppointmentAccessService } from '../appointments/appointment-access.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway, type RealtimeSocket } from './realtime.gateway';
import { RealtimeService, type RealtimeServer } from './realtime.service';

interface SocketMock {
  id: string;
  data: { user?: AuthenticatedUser };
  handshake: {
    auth: Record<string, unknown>;
    headers: Record<string, string | undefined>;
  };
  rooms: Set<string>;
  join: jest.Mock<Promise<void>, [string]>;
  leave: jest.Mock<Promise<void>, [string]>;
  emit: jest.Mock;
  to: jest.Mock;
  disconnect: jest.Mock;
}

function createSocketMock(overrides: Partial<SocketMock> = {}): {
  socket: RealtimeSocket;
  mock: SocketMock;
  broadcastEmit: jest.Mock;
} {
  const broadcastEmit = jest.fn();
  const mock: SocketMock = {
    id: 'socket-1',
    data: {},
    handshake: { auth: {}, headers: {} },
    rooms: new Set<string>(),
    join: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    leave: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: broadcastEmit }),
    disconnect: jest.fn(),
    ...overrides,
  };
  return {
    socket: mock as unknown as RealtimeSocket,
    mock,
    broadcastEmit,
  };
}

function createServerMock(): {
  server: RealtimeServer;
  to: jest.Mock;
  emit: jest.Mock;
} {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  return { server: { to } as unknown as RealtimeServer, to, emit };
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let accessService: { assertAppointmentAccess: jest.Mock };
  let prisma: { user: { findFirst: jest.Mock } };
  let realtimeService: RealtimeService;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    accessService = { assertAppointmentAccess: jest.fn() };
    prisma = { user: { findFirst: jest.fn() } };
    realtimeService = new RealtimeService({
      get: jest.fn(),
    } as unknown as ConfigService);
    gateway = new RealtimeGateway(
      jwtService as unknown as JwtService,
      accessService as unknown as AppointmentAccessService,
      realtimeService,
      prisma as unknown as PrismaService,
    );
  });

  describe('handleConnection', () => {
    it('disconnects a client with an invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
      const { socket, mock } = createSocketMock({
        handshake: { auth: { token: 'not-a-jwt' }, headers: {} },
      });

      await gateway.handleConnection(socket);

      expect(mock.disconnect).toHaveBeenCalledWith(true);
      expect(mock.data.user).toBeUndefined();
    });

    it('rejects a payload with an unexpected role', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', role: 'admin' });
      const { socket, mock } = createSocketMock({
        handshake: { auth: { token: 'token' }, headers: {} },
      });

      await gateway.handleConnection(socket);

      expect(mock.disconnect).toHaveBeenCalledWith(true);
      expect(mock.data.user).toBeUndefined();
    });

    it('accepts a valid access token from the handshake auth', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', role: 'patient' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', role: 'patient' });
      const { socket, mock } = createSocketMock({
        handshake: { auth: { token: 'token' }, headers: {} },
      });

      await gateway.handleConnection(socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('token');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', deletedAt: null },
        select: { id: true, role: true },
      });
      expect(mock.data.user).toEqual({ sub: 'u1', role: 'patient' });
      expect(mock.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to the Authorization bearer header', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'u2', role: 'doctor' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u2', role: 'doctor' });
      const { socket, mock } = createSocketMock({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
        },
      });

      await gateway.handleConnection(socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('header-token');
      expect(mock.data.user).toEqual({ sub: 'u2', role: 'doctor' });
    });

    it('disconnects when the token user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'u3', role: 'patient' });
      prisma.user.findFirst.mockResolvedValue(null);
      const { socket, mock } = createSocketMock({
        handshake: { auth: { token: 'token' }, headers: {} },
      });

      await gateway.handleConnection(socket);

      expect(mock.disconnect).toHaveBeenCalledWith(true);
      expect(mock.data.user).toBeUndefined();
      expect(mock.join).not.toHaveBeenCalled();
    });
  });

  describe('room.join', () => {
    it('rejects a non-participant with a generic room.error', async () => {
      accessService.assertAppointmentAccess.mockRejectedValue(
        new ForbiddenException(),
      );
      const { socket, mock } = createSocketMock();
      mock.data.user = { sub: 'u1', role: 'patient' };

      await gateway.handleRoomJoin(socket, { appointmentId: 'a1' });

      expect(mock.emit).toHaveBeenCalledWith('room.error', {
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
      expect(mock.join).not.toHaveBeenCalled();
      expect(realtimeService.getParticipants('a1')).toEqual([]);
    });

    it('joins the appointment and user rooms and sets presence', async () => {
      accessService.assertAppointmentAccess.mockResolvedValue(undefined);
      const { socket, mock, broadcastEmit } = createSocketMock();
      mock.data.user = { sub: 'u1', role: 'patient' };

      await gateway.handleRoomJoin(socket, { appointmentId: 'a1' });

      expect(mock.join).toHaveBeenCalledWith('appointment:a1');
      expect(mock.join).toHaveBeenCalledWith('user:u1');
      expect(realtimeService.getParticipants('a1')).toHaveLength(1);
      expect(mock.emit).toHaveBeenCalledWith(
        'room.joined',
        expect.objectContaining({
          appointmentId: 'a1',
          participants: [
            expect.objectContaining({ userId: 'u1', role: 'patient' }),
          ],
        }),
      );
      expect(broadcastEmit).toHaveBeenCalledWith(
        'participant.joined',
        expect.objectContaining({
          appointmentId: 'a1',
          userId: 'u1',
          role: 'patient',
        }),
      );
    });
  });

  describe('relays', () => {
    it('ignores relays before the socket has joined the room', () => {
      const { socket, mock } = createSocketMock();
      mock.data.user = { sub: 'u1', role: 'patient' };

      gateway.handleWebrtcOffer(socket, { appointmentId: 'a1', sdp: 'v=0' });
      gateway.handleMediaState(socket, {
        appointmentId: 'a1',
        mic: true,
        camera: true,
      });

      expect(mock.to).not.toHaveBeenCalled();
      expect(accessService.assertAppointmentAccess).not.toHaveBeenCalled();
    });

    it('relays an offer to the room with the sender id', () => {
      const { socket, mock, broadcastEmit } = createSocketMock();
      mock.data.user = { sub: 'doctor-1', role: 'doctor' };
      mock.rooms.add('appointment:a1');

      gateway.handleWebrtcOffer(socket, { appointmentId: 'a1', sdp: 'v=0' });

      expect(mock.to).toHaveBeenCalledWith('appointment:a1');
      expect(broadcastEmit).toHaveBeenCalledWith('webrtc.offer', {
        appointmentId: 'a1',
        fromUserId: 'doctor-1',
        sdp: 'v=0',
      });
    });

    it('relays media state with the sender id', () => {
      const { socket, mock, broadcastEmit } = createSocketMock();
      mock.data.user = { sub: 'doctor-1', role: 'doctor' };
      mock.rooms.add('appointment:a1');

      gateway.handleMediaState(socket, {
        appointmentId: 'a1',
        mic: false,
        camera: true,
      });

      expect(broadcastEmit).toHaveBeenCalledWith('media.state', {
        appointmentId: 'a1',
        userId: 'doctor-1',
        mic: false,
        camera: true,
      });
    });
  });

  describe('room.leave and disconnect', () => {
    it('removes presence and broadcasts participant.left on leave', async () => {
      const { socket, mock } = createSocketMock();
      mock.data.user = { sub: 'u1', role: 'patient' };
      mock.rooms.add('appointment:a1');
      realtimeService.addParticipant('a1', 'u1', 'patient', mock.id);
      const { server, to, emit } = createServerMock();
      realtimeService.setServer(server);

      await gateway.handleRoomLeave(socket, { appointmentId: 'a1' });

      expect(mock.leave).toHaveBeenCalledWith('appointment:a1');
      expect(to).toHaveBeenCalledWith('appointment:a1');
      expect(emit).toHaveBeenCalledWith(
        'participant.left',
        expect.objectContaining({ appointmentId: 'a1', userId: 'u1' }),
      );
      expect(realtimeService.getParticipants('a1')).toEqual([]);
    });

    it('broadcasts participant.left for every room on disconnect', () => {
      const { socket, mock } = createSocketMock();
      realtimeService.addParticipant('a1', 'u1', 'patient', mock.id);
      realtimeService.addParticipant('a2', 'u1', 'patient', mock.id);
      const { server, to, emit } = createServerMock();
      realtimeService.setServer(server);

      gateway.handleDisconnect(socket);

      expect(to).toHaveBeenCalledWith('appointment:a1');
      expect(to).toHaveBeenCalledWith('appointment:a2');
      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit).toHaveBeenCalledWith(
        'participant.left',
        expect.objectContaining({ userId: 'u1' }),
      );
    });
  });
});
