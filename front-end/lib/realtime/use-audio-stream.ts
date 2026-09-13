"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildAudioChunkPayload,
  computeRmsLevel,
  PcmFrameBatcher,
  PCM_BATCH_SAMPLES,
  StreamingResampler,
} from "./pcm";
import { useRealtime } from "./socket-context";

const WORKLET_URL = "/worklets/pcm-capture-processor.js";
const WORKLET_NAME = "pcm-capture-processor";
const LEVEL_INTERVAL_MS = 100;

export interface UseAudioStreamOptions {
  consultationId: string;
  stream: MediaStream | null;
  remoteStream?: MediaStream | null;
  enabled?: boolean;
}

export interface UseAudioStreamResult {
  start: () => Promise<void>;
  stop: () => void;
  isStreaming: boolean;
  level: number;
  sourceCount: number;
  error: string | null;
}

export function useAudioStream({
  consultationId,
  stream,
  remoteStream = null,
  enabled = true,
}: UseAudioStreamOptions): UseAudioStreamResult {
  const { socket } = useRealtime();
  const [isStreaming, setIsStreaming] = useState(false);
  const [level, setLevel] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [remoteVersion, setRemoteVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(stream);
  const enabledRef = useRef(enabled);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mixerRef = useRef<GainNode | null>(null);
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
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isStreaming || !remoteStream) {
      return;
    }
    const bump = (): void => {
      setRemoteVersion((current) => current + 1);
    };
    remoteStream.addEventListener("addtrack", bump);
    remoteStream.addEventListener("removetrack", bump);
    return () => {
      remoteStream.removeEventListener("addtrack", bump);
      remoteStream.removeEventListener("removetrack", bump);
    };
  }, [remoteStream, isStreaming]);

  const teardown = useCallback((): void => {
    remoteSourceRef.current?.disconnect();
    mixerRef.current?.disconnect();
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    const context = contextRef.current;
    if (context && context.state !== "closed") {
      void context.close();
    }
    remoteSourceRef.current = null;
    mixerRef.current = null;
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
      setSourceCount(0);
    }
  }, [consultationId, socket, teardown]);

  const start = useCallback(async (): Promise<void> => {
    if (streamingRef.current || !enabledRef.current) {
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
      const context = new AudioContext();
      if (!context.audioWorklet) {
        await context.close();
        setError("Captura de áudio em tempo real indisponível neste navegador.");
        return;
      }
      await context.resume();
      await context.audioWorklet.addModule(WORKLET_URL);

      const source = context.createMediaStreamSource(mediaStream);
      const mixer = context.createGain();
      mixer.gain.value = 1;
      const worklet = new AudioWorkletNode(context, WORKLET_NAME, {
        numberOfOutputs: 0,
      });

      const batch = new PcmFrameBatcher(PCM_BATCH_SAMPLES);
      const resampler = new StreamingResampler(context.sampleRate);
      batcherRef.current = batch;
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
        const resampled = resampler.push(data);
        if (resampled.length === 0) {
          return;
        }
        const now = performance.now();
        if (now - lastLevelAtRef.current >= LEVEL_INTERVAL_MS) {
          lastLevelAtRef.current = now;
          if (activeRef.current) {
            setLevel(computeRmsLevel(resampled));
          }
        }
        for (const frame of batch.push(resampled)) {
          emitChunk(frame);
        }
      };

      source.connect(mixer);
      mixer.connect(worklet);

      contextRef.current = context;
      sourceRef.current = source;
      mixerRef.current = mixer;
      workletRef.current = worklet;
      streamingRef.current = true;
      setIsStreaming(true);
      setSourceCount(1);
    } catch (caught) {
      console.error(
        "pcm-capture-failed",
        caught instanceof Error ? `${caught.name}: ${caught.message}` : "unknown",
      );
      teardown();
      streamingRef.current = false;
      if (activeRef.current) {
        setError(
          `Não foi possível iniciar a captura de áudio do copiloto. Verifique o microfone e tente novamente.${
            caught instanceof Error ? ` (${caught.name})` : ""
          }`,
        );
      }
    }
  }, [consultationId, socket, teardown]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    const context = contextRef.current;
    const mixer = mixerRef.current;
    if (!context || !mixer) {
      return;
    }
    remoteSourceRef.current?.disconnect();
    remoteSourceRef.current = null;
    const hasRemoteAudio =
      remoteStream !== null && remoteStream.getAudioTracks().length > 0;
    const remoteSource = hasRemoteAudio
      ? context.createMediaStreamSource(remoteStream)
      : null;
    if (remoteSource) {
      remoteSource.connect(mixer);
      remoteSourceRef.current = remoteSource;
    }
    setSourceCount((sourceRef.current ? 1 : 0) + (remoteSource ? 1 : 0));
    return () => {
      remoteSource?.disconnect();
      if (remoteSourceRef.current === remoteSource) {
        remoteSourceRef.current = null;
      }
    };
  }, [remoteStream, remoteVersion, isStreaming]);

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
      setIsStreaming(false);
      setLevel(0);
      setSourceCount(0);
    };
  }, [consultationId, socket, teardown]);

  return { start, stop, isStreaming, level, sourceCount, error };
}
