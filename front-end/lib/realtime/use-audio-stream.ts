"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildAudioChunkPayload,
  computeRmsLevel,
  PcmFrameBatcher,
  PCM_BATCH_SAMPLES,
  PCM_SAMPLE_RATE,
} from "./pcm";
import { useRealtime } from "./socket-context";

const WORKLET_URL = "/worklets/pcm-capture-processor.js";
const WORKLET_NAME = "pcm-capture-processor";
const LEVEL_INTERVAL_MS = 100;

export interface UseAudioStreamOptions {
  consultationId: string;
  stream: MediaStream | null;
}

export interface UseAudioStreamResult {
  start: () => Promise<void>;
  stop: () => void;
  isStreaming: boolean;
  level: number;
  error: string | null;
}

export function useAudioStream({
  consultationId,
  stream,
}: UseAudioStreamOptions): UseAudioStreamResult {
  const { socket } = useRealtime();
  const [isStreaming, setIsStreaming] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(stream);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const batcherRef = useRef<PcmFrameBatcher | null>(null);
  const seqRef = useRef(0);
  const streamingRef = useRef(false);
  const lastLevelAtRef = useRef(0);
  const activeRef = useRef(true);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const teardown = useCallback((): void => {
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    const context = contextRef.current;
    if (context && context.state !== "closed") {
      void context.close();
    }
    workletRef.current = null;
    sourceRef.current = null;
    contextRef.current = null;
    batcherRef.current = null;
  }, []);

  const stop = useCallback((): void => {
    if (!streamingRef.current) {
      return;
    }
    streamingRef.current = false;
    const batcher = batcherRef.current;
    const pending = batcher?.flush() ?? null;
    if (pending && pending.length > 0 && socket) {
      socket.emit(
        "audio.chunk",
        buildAudioChunkPayload(consultationId, seqRef.current, pending),
      );
      seqRef.current += 1;
    }
    socket?.emit("audio.end", { consultationId, seq: seqRef.current });
    teardown();
    if (activeRef.current) {
      setIsStreaming(false);
      setLevel(0);
    }
  }, [consultationId, socket, teardown]);

  const start = useCallback(async (): Promise<void> => {
    if (streamingRef.current) {
      return;
    }
    activeRef.current = true;
    setError(null);

    const mediaStream = streamRef.current;
    if (!mediaStream || mediaStream.getAudioTracks().length === 0) {
      setError("Microfone indisponível para o copiloto. Entre na sala primeiro.");
      return;
    }
    if (!socket) {
      setError("Sem conexão com o servidor do copiloto.");
      return;
    }
    if (typeof window === "undefined" || typeof AudioContext === "undefined") {
      setError("Este navegador não oferece suporte à captura de áudio.");
      return;
    }

    try {
      const context = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
      if (!context.audioWorklet) {
        await context.close();
        setError("Captura de áudio em tempo real indisponível neste navegador.");
        return;
      }
      await context.audioWorklet.addModule(WORKLET_URL);

      const source = context.createMediaStreamSource(mediaStream);
      const worklet = new AudioWorkletNode(context, WORKLET_NAME, {
        numberOfOutputs: 0,
      });

      const batch = new PcmFrameBatcher(PCM_BATCH_SAMPLES);
      batcherRef.current = batch;
      seqRef.current = 0;
      lastLevelAtRef.current = 0;

      const emitChunk = (samples: Float32Array): void => {
        socket.emit(
          "audio.chunk",
          buildAudioChunkPayload(consultationId, seqRef.current, samples),
        );
        seqRef.current += 1;
      };

      worklet.port.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (!(data instanceof Float32Array) || data.length === 0) {
          return;
        }
        const now = performance.now();
        if (now - lastLevelAtRef.current >= LEVEL_INTERVAL_MS) {
          lastLevelAtRef.current = now;
          if (activeRef.current) {
            setLevel(computeRmsLevel(data));
          }
        }
        for (const frame of batch.push(data)) {
          emitChunk(frame);
        }
      };

      source.connect(worklet);

      contextRef.current = context;
      sourceRef.current = source;
      workletRef.current = worklet;
      streamingRef.current = true;
      setIsStreaming(true);
    } catch {
      teardown();
      streamingRef.current = false;
      if (activeRef.current) {
        setError(
          "Não foi possível iniciar a captura de áudio do copiloto. Verifique o microfone e tente novamente.",
        );
      }
    }
  }, [consultationId, socket, teardown]);

  useEffect(() => {
    return () => {
      if (streamingRef.current) {
        streamingRef.current = false;
        const batcher = batcherRef.current;
        const pending = batcher?.flush() ?? null;
        if (pending && pending.length > 0 && socket) {
          socket.emit(
            "audio.chunk",
            buildAudioChunkPayload(consultationId, seqRef.current, pending),
          );
          seqRef.current += 1;
        }
        socket?.emit("audio.end", { consultationId, seq: seqRef.current });
      }
      teardown();
    };
  }, [consultationId, socket, teardown]);

  return { start, stop, isStreaming, level, error };
}
