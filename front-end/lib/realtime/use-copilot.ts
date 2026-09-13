"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "./socket-context";
import type {
  AiStatus,
  CopilotInsight,
  RealtimeEventPayload,
  TranscriptSegment,
} from "./types";

const MAX_SEGMENTS = 200;
const MAX_INSIGHTS = 100;

export interface UseCopilotResult {
  partial: string | null;
  segments: TranscriptSegment[];
  insights: CopilotInsight[];
  aiStatus: AiStatus;
  clear: () => void;
}

export function useCopilot(
  consultationId: string,
  enabled: boolean,
): UseCopilotResult {
  const { socket } = useRealtime();
  const [partial, setPartial] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [insights, setInsights] = useState<CopilotInsight[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus>("connecting");
  const seenSegmentsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !socket) {
      return;
    }

    const markReady = (): void => {
      setAiStatus((current) => (current === "ready" ? current : "ready"));
    };

    const onPartial = (
      payload: RealtimeEventPayload<"transcript.partial">,
    ): void => {
      if (payload.consultationId !== consultationId) {
        return;
      }
      markReady();
      setPartial(payload.text);
    };

    const onFinal = (
      payload: RealtimeEventPayload<"transcript.final">,
    ): void => {
      if (payload.consultationId !== consultationId) {
        return;
      }
      if (seenSegmentsRef.current.has(payload.segmentId)) {
        return;
      }
      seenSegmentsRef.current.add(payload.segmentId);
      markReady();
      setSegments((current) =>
        [
          ...current,
          {
            id: payload.segmentId,
            text: payload.text,
            at: payload.at,
          },
        ].slice(-MAX_SEGMENTS),
      );
      setPartial(null);
    };

    const onFeedback = (
      payload: RealtimeEventPayload<"copilot.feedback">,
    ): void => {
      if (payload.consultationId !== consultationId) {
        return;
      }
      markReady();
      setInsights((current) =>
        [
          ...current,
          {
            id: `${payload.at}-${payload.severity}-${current.length}`,
            severity: payload.severity,
            message: payload.message,
            at: payload.at,
            tags: payload.tags,
          },
        ].slice(-MAX_INSIGHTS),
      );
    };

    const onStatus = (
      payload: RealtimeEventPayload<"ai.status">,
    ): void => {
      if (payload.consultationId !== consultationId) {
        return;
      }
      setAiStatus(payload.status);
    };

    socket.on("transcript.partial", onPartial);
    socket.on("transcript.final", onFinal);
    socket.on("copilot.feedback", onFeedback);
    socket.on("ai.status", onStatus);

    return () => {
      socket.off("transcript.partial", onPartial);
      socket.off("transcript.final", onFinal);
      socket.off("copilot.feedback", onFeedback);
      socket.off("ai.status", onStatus);
    };
  }, [socket, consultationId, enabled]);

  const clear = useCallback((): void => {
    seenSegmentsRef.current.clear();
    setPartial(null);
    setSegments([]);
    setInsights([]);
  }, []);

  return { partial, segments, insights, aiStatus, clear };
}
