import type {
  FeedbackSeverity,
  ServerToClientEvents,
  UserRole,
} from "@telemed/service-contracts";

export type RealtimeEventPayload<K extends keyof ServerToClientEvents> =
  Parameters<ServerToClientEvents[K]>[0];

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type AiStatus = "connecting" | "ready" | "unavailable";

export interface RoomParticipant {
  userId: string;
  role: UserRole;
  joinedAt: string | null;
  mic: boolean;
  camera: boolean;
  isSelf: boolean;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  at: string;
}

export interface CopilotInsight {
  id: string;
  severity: FeedbackSeverity;
  message: string;
  at: string;
  tags: string[];
}
