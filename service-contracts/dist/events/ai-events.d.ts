import type { FeedbackSeverity } from '../types/common';
export interface CreateAiSessionRequestDto {
    consultationId: string;
    appointmentId: string;
    language: 'pt-BR';
}
export interface AiSessionCreatedDto {
    sessionId: string;
    expiresAt: string;
}
export interface AiHealthDto {
    status: 'ok';
    provider: string;
    timestamp: string;
}
export type AiClientFrame = {
    type: 'audio.chunk';
    seq: number;
    data: string;
    encoding: 'pcm_s16le';
    sampleRate: number;
    channels: 1;
} | {
    type: 'audio.end';
    seq: number;
} | {
    type: 'session.close';
    reason?: string;
};
export type AiServerFrame = {
    type: 'transcript.partial';
    text: string;
    at: string;
} | {
    type: 'transcript.final';
    segmentId: string;
    text: string;
    at: string;
} | {
    type: 'copilot.feedback';
    severity: FeedbackSeverity;
    message: string;
    at: string;
    tags: string[];
} | {
    type: 'error';
    code: string;
    message: string;
    at: string;
};
//# sourceMappingURL=ai-events.d.ts.map