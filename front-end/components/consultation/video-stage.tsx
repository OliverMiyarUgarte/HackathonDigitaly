"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Loader2, Video } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RealtimeConnectionState, RoomParticipant } from "@/lib/realtime/types";

export interface VideoStageProps {
  stageRef: RefObject<HTMLDivElement | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  participants: RoomParticipant[];
  names: Record<string, string>;
  connectionState: RealtimeConnectionState;
  elapsedSeconds: number;
}

const STATE_LABEL: Record<RealtimeConnectionState, string> = {
  idle: "Aguardando",
  connecting: "Conectando",
  connected: "Conectado",
  reconnecting: "Reconectando",
  failed: "Falha na conexão",
};

const STATE_VARIANT: Record<RealtimeConnectionState, BadgeVariant> = {
  idle: "neutral",
  connecting: "brand",
  connected: "success",
  reconnecting: "warning",
  failed: "error",
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function roleLabel(role: RoomParticipant["role"]): string {
  return role === "doctor" ? "Médico" : "Paciente";
}

function VideoSurface({
  stream,
  muted,
  testId,
  label,
  className,
}: {
  stream: MediaStream | null;
  muted: boolean;
  testId: string;
  label: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
    }
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      data-testid={testId}
      className={cn("size-full object-cover", className)}
    />
  );
}

export function VideoStage({
  stageRef,
  localStream,
  remoteStream,
  participants,
  names,
  connectionState,
  elapsedSeconds,
}: VideoStageProps) {
  const hasRemoteVideo =
    (remoteStream?.getVideoTracks().length ?? 0) > 0;
  const remoteParticipants = participants.filter(
    (participant) => !participant.isSelf,
  );

  return (
    <div
      ref={stageRef}
      className="relative aspect-video w-full overflow-hidden rounded-lg border border-borda bg-grafite-950"
    >
      {remoteStream ? (
        <VideoSurface
          stream={remoteStream}
          muted={false}
          testId="remote-video"
          label="Vídeo do participante remoto"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 text-texto-3">
          {connectionState === "connecting" ||
          connectionState === "reconnecting" ? (
            <Loader2 aria-hidden="true" className="size-8 animate-spin text-celeste-500" />
          ) : (
            <Video aria-hidden="true" className="size-8" />
          )}
          <p className="text-sm">
            {hasRemoteVideo ? "Aguardando vídeo" : "Aguardando o outro participante"}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={STATE_VARIANT[connectionState]}
            live={
              connectionState === "connected" ||
              connectionState === "connecting" ||
              connectionState === "reconnecting"
            }
          >
            {STATE_LABEL[connectionState]}
          </Badge>
          <Badge variant="neutral">
            <span className="font-data tabular-nums">
              {formatClock(elapsedSeconds)}
            </span>
          </Badge>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
        <div className="flex flex-wrap gap-2">
          {remoteParticipants.length === 0 ? (
            <Badge variant="outline">Sem participantes remotos</Badge>
          ) : (
            remoteParticipants.map((participant) => (
              <span
                key={participant.userId}
                data-testid="participant"
                data-participant-role={participant.role}
                data-mic={participant.mic}
                data-camera={participant.camera}
                data-self="false"
              >
                <Badge variant="brand" live>
                  {names[participant.userId] ?? roleLabel(participant.role)}
                  {!participant.mic ? " · mic off" : ""}
                  {!participant.camera ? " · câmera off" : ""}
                </Badge>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="absolute bottom-16 right-3 h-24 w-36 overflow-hidden rounded-md border border-borda-forte bg-grafite-900 shadow-lg sm:h-32 sm:w-48">
        {localStream ? (
          <VideoSurface
            stream={localStream}
            muted
            testId="local-video"
            label="Seu vídeo"
            className="scale-x-[-1]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-texto-3">
            Sem câmera
          </div>
        )}
      </div>
    </div>
  );
}
