import type { ConfigService } from '@nestjs/config';
import { RealtimeService, type RealtimeServer } from './realtime.service';

function createConfigMock(
  values: Record<string, string | undefined>,
): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
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

describe('RealtimeService', () => {
  describe('buildIceServers', () => {
    it('returns the default STUN server when STUN_URLS is not set', () => {
      const service = new RealtimeService(createConfigMock({}));

      expect(service.buildIceServers()).toEqual([
        { urls: ['stun:stun.l.google.com:19302'] },
      ]);
    });

    it('parses a comma-separated STUN list', () => {
      const service = new RealtimeService(
        createConfigMock({
          STUN_URLS: 'stun:a.example:3478, stun:b.example:3478',
        }),
      );

      expect(service.buildIceServers()).toEqual([
        { urls: ['stun:a.example:3478', 'stun:b.example:3478'] },
      ]);
    });

    it('adds a TURN server with credentials when configured', () => {
      const service = new RealtimeService(
        createConfigMock({
          STUN_URLS: 'stun:stun.l.google.com:19302',
          TURN_URLS: 'turn:turn.example:3478?transport=udp',
          TURN_USERNAME: 'turn-user',
          TURN_CREDENTIAL: 'turn-secret',
        }),
      );

      expect(service.buildIceServers()).toEqual([
        { urls: ['stun:stun.l.google.com:19302'] },
        {
          urls: ['turn:turn.example:3478?transport=udp'],
          username: 'turn-user',
          credential: 'turn-secret',
        },
      ]);
    });

    it('omits TURN credentials when they are absent', () => {
      const service = new RealtimeService(
        createConfigMock({ TURN_URLS: 'turn:turn.example:3478' }),
      );

      const [, turnServer] = service.buildIceServers();

      expect(turnServer).toEqual({ urls: ['turn:turn.example:3478'] });
      expect(turnServer).not.toHaveProperty('username');
      expect(turnServer).not.toHaveProperty('credential');
    });
  });

  describe('presence', () => {
    it('tracks participants per appointment', () => {
      const service = new RealtimeService(createConfigMock({}));

      service.addParticipant('a1', 'u1', 'patient', 's1');
      service.addParticipant('a1', 'u2', 'doctor', 's2');
      service.addParticipant('a2', 'u3', 'patient', 's3');

      expect(service.getParticipants('a1')).toHaveLength(2);
      expect(service.getParticipants('a2')).toHaveLength(1);
      expect(service.getParticipants('a1')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'u1', role: 'patient' }),
          expect.objectContaining({ userId: 'u2', role: 'doctor' }),
        ]),
      );
    });

    it('removes the participant when the last socket leaves', () => {
      const service = new RealtimeService(createConfigMock({}));
      service.addParticipant('a1', 'u1', 'patient', 's1');

      const left = service.removeFromAppointment('a1', 's1');

      expect(left).toMatchObject({ userId: 'u1', role: 'patient' });
      expect(service.getParticipants('a1')).toEqual([]);
    });

    it('keeps presence on reconnect when another socket still holds the room', () => {
      const service = new RealtimeService(createConfigMock({}));
      service.addParticipant('a1', 'u1', 'patient', 's1');
      service.addParticipant('a1', 'u1', 'patient', 's2');

      expect(service.removeFromAppointment('a1', 's1')).toBeNull();
      expect(service.getParticipants('a1')).toHaveLength(1);

      expect(service.removeFromAppointment('a1', 's2')).toMatchObject({
        userId: 'u1',
      });
      expect(service.getParticipants('a1')).toEqual([]);
    });

    it('removes every membership on disconnect', () => {
      const service = new RealtimeService(createConfigMock({}));
      service.addParticipant('a1', 'u1', 'patient', 's1');
      service.addParticipant('a2', 'u1', 'patient', 's1');

      const left = service.removeSocket('s1');

      expect(left).toHaveLength(2);
      expect(service.getParticipants('a1')).toEqual([]);
      expect(service.getParticipants('a2')).toEqual([]);
      expect(service.removeSocket('s1')).toEqual([]);
    });
  });

  describe('emit facade', () => {
    it('emits to the appointment room', () => {
      const service = new RealtimeService(createConfigMock({}));
      const { server, to, emit } = createServerMock();
      service.setServer(server);

      service.emitToAppointment('a1', 'participant.left', {
        appointmentId: 'a1',
        userId: 'u1',
        role: 'patient',
        leftAt: '2026-01-01T00:00:00.000Z',
      });

      expect(to).toHaveBeenCalledWith('appointment:a1');
      expect(emit).toHaveBeenCalledWith('participant.left', {
        appointmentId: 'a1',
        userId: 'u1',
        role: 'patient',
        leftAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('emits to the user room', () => {
      const service = new RealtimeService(createConfigMock({}));
      const { server, to, emit } = createServerMock();
      service.setServer(server);

      service.emitToUser('u1', 'ai.status', {
        consultationId: 'c1',
        status: 'ready',
      });

      expect(to).toHaveBeenCalledWith('user:u1');
      expect(emit).toHaveBeenCalledWith('ai.status', {
        consultationId: 'c1',
        status: 'ready',
      });
    });

    it('is a no-op before the server is initialized', () => {
      const service = new RealtimeService(createConfigMock({}));

      expect(() =>
        service.emitToAppointment('a1', 'room.error', {
          code: 'FORBIDDEN',
          message: 'Access denied',
        }),
      ).not.toThrow();
      expect(() =>
        service.emitToUser('u1', 'room.error', {
          code: 'FORBIDDEN',
          message: 'Access denied',
        }),
      ).not.toThrow();
    });
  });
});
