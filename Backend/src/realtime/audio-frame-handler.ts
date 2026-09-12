import type { ClientToServerEvents } from '@telemed/service-contracts';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

export type AudioChunkFrame = Parameters<
  ClientToServerEvents['audio.chunk']
>[0];

export type AudioEndFrame = Parameters<ClientToServerEvents['audio.end']>[0];

export interface AudioFrameHandler {
  handleAudioChunk(
    user: AuthenticatedUser,
    frame: AudioChunkFrame,
  ): Promise<void> | void;
  handleAudioEnd(
    user: AuthenticatedUser,
    frame: AudioEndFrame,
  ): Promise<void> | void;
}
