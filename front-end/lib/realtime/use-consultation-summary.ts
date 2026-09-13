"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get } from "@/lib/api";
import {
  consultationSummarySchema,
  type ConsultationSummaryDto,
} from "@/lib/contracts";
import { useRealtime } from "./socket-context";
import type { ConsultationSummaryEvent } from "./types";

export type ConsultationSummaryStatus =
  | "loading"
  | "pending"
  | "ready"
  | "error";

export interface UseConsultationSummaryResult {
  summary: ConsultationSummaryDto | null;
  status: ConsultationSummaryStatus;
  refresh: () => void;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;

export function useConsultationSummary(
  consultationId: string,
  enabled: boolean,
): UseConsultationSummaryResult {
  const { socket } = useRealtime();
  const [summary, setSummary] = useState<ConsultationSummaryDto | null>(null);
  const [status, setStatus] = useState<ConsultationSummaryStatus>("loading");
  const [refreshKey, setRefreshKey] = useState(0);
  const generationRef = useRef(0);
  const waitRef = useRef<{ timer: number; resolve: () => void } | null>(null);

  const cancelWait = useCallback((): void => {
    const current = waitRef.current;
    if (current) {
      window.clearTimeout(current.timer);
      waitRef.current = null;
      current.resolve();
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let finished = false;

    const isCurrent = (): boolean =>
      !finished && generationRef.current === generation;

    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const timer = window.setTimeout(() => {
          waitRef.current = null;
          resolve();
        }, ms);
        waitRef.current = { timer, resolve };
      });

    const onSummary = (payload: ConsultationSummaryEvent): void => {
      if (payload.consultationId !== consultationId) {
        return;
      }
      const parsed = consultationSummarySchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }
      finished = true;
      generationRef.current += 1;
      cancelWait();
      setSummary(parsed.data);
      setStatus("ready");
    };

    socket?.on("consultation.summary", onSummary);

    const run = async (): Promise<void> => {
      let attempt = 0;
      while (isCurrent()) {
        try {
          const data = await get(
            `/consultations/${consultationId}/summary`,
            consultationSummarySchema,
          );
          if (!isCurrent()) {
            return;
          }
          finished = true;
          setSummary(data);
          setStatus("ready");
          return;
        } catch (error) {
          if (!isCurrent()) {
            return;
          }
          if (error instanceof ApiError && error.status === 404) {
            setStatus("pending");
            const delay = RETRY_DELAYS_MS[attempt];
            if (delay === undefined) {
              return;
            }
            attempt += 1;
            await wait(delay);
            continue;
          }
          setStatus("error");
          return;
        }
      }
    };

    void run();

    return () => {
      finished = true;
      generationRef.current += 1;
      socket?.off("consultation.summary", onSummary);
      cancelWait();
    };
  }, [consultationId, enabled, socket, refreshKey, cancelWait]);

  const refresh = useCallback((): void => {
    setSummary(null);
    setStatus("loading");
    setRefreshKey((current) => current + 1);
  }, []);

  return { summary, status, refresh };
}
