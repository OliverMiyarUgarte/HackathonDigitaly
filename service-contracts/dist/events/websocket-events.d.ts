import type { FeedbackSeverity, UserRole } from '../types/common';
import type { IceServerDto, ParticipantDto } from '../types/consultations';
export interface SocketData {
    user: {
        sub: string;
        role: UserRole;
    };
}
export interface ClientToServerEvents {
    'room.join': (payload: {
        appointmentId: string;
    }) => void;
    'room.leave': (payload: {
        appointmentId: string;
    }) => void;
    'webrtc.offer': (payload: {
        appointmentId: string;
        sdp: string;
        to?: string;
    }) => void;
    'webrtc.answer': (payload: {
        appointmentId: string;
        sdp: string;
        to?: string;
    }) => void;
    'webrtc.ice': (payload: {
        appointmentId: string;
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
        to?: string;
    }) => void;
    'media.state': (payload: {
        appointmentId: string;
        mic: boolean;
        camera: boolean;
    }) => void;
    'audio.chunk': (payload: {
        consultationId: string;
        seq: number;
        data: string;
        encoding: 'pcm_s16le';
        sampleRate: number;
        channels: 1;
    }) => void;
    'audio.end': (payload: {
        consultationId: string;
        seq: number;
    }) => void;
}
export interface ServerToClientEvents {
    'room.joined': (payload: {
        appointmentId: string;
        participants: ParticipantDto[];
        iceServers: IceServerDto[];
    }) => void;
    'room.error': (payload: {
        code: string;
        message: string;
    }) => void;
    'consultation.started': (payload: {
        appointmentId: string;
        consultationId: string;
        doctorId: string;
        startedAt: string;
    }) => void;
    'consultation.ended': (payload: {
        appointmentId: string;
        consultationId: string;
        endedAt: string;
    }) => void;
    'participant.joined': (payload: {
        appointmentId: string;
        userId: string;
        role: UserRole;
        joinedAt: string;
    }) => void;
    'participant.left': (payload: {
        appointmentId: string;
        userId: string;
        role: UserRole;
        leftAt: string;
    }) => void;
    'webrtc.offer': (payload: {
        appointmentId: string;
        fromUserId: string;
        sdp: string;
    }) => void;
    'webrtc.answer': (payload: {
        appointmentId: string;
        fromUserId: string;
        sdp: string;
    }) => void;
    'webrtc.ice': (payload: {
        appointmentId: string;
        fromUserId: string;
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
    }) => void;
    'media.state': (payload: {
        appointmentId: string;
        userId: string;
        mic: boolean;
        camera: boolean;
    }) => void;
    'transcript.partial': (payload: {
        consultationId: string;
        text: string;
        at: string;
    }) => void;
    'transcript.final': (payload: {
        consultationId: string;
        segmentId: string;
        text: string;
        at: string;
    }) => void;
    'copilot.feedback': (payload: {
        consultationId: string;
        severity: FeedbackSeverity;
        message: string;
        at: string;
        tags: string[];
    }) => void;
    'ai.status': (payload: {
        consultationId: string;
        status: 'connecting' | 'ready' | 'unavailable';
    }) => void;
    error: (payload: {
        code: string;
        message: string;
    }) => void;
}
export type InterServerEvents = Record<string, never>;
//# sourceMappingURL=websocket-events.d.ts.map