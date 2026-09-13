"use client";

import { useEffect, useRef } from "react";
import { Camera, CameraOff, Mic, MicOff, ShieldCheck, Video } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTimeWithContext } from "@/lib/format";

export interface PreCallLobbyProps {
  counterpartLabel: string;
  scheduledAt?: string | null;
  localStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  isPreparing: boolean;
  isStarting: boolean;
  error: string | null;
  onPrepare: () => void;
  onEnter: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

function DevicePreview({ stream }: { stream: MediaStream | null }) {
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
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-borda bg-grafite-950">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Pré-visualização da sua câmera"
          data-testid="device-preview"
          className="size-full scale-x-[-1] object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-texto-3">
          <Video aria-hidden="true" className="size-8" />
          <p className="max-w-[36ch] text-sm">
            Teste sua câmera e microfone antes de entrar na sala. A permissão é
            solicitada apenas quando você clicar no botão.
          </p>
        </div>
      )}
    </div>
  );
}

export function PreCallLobby({
  counterpartLabel,
  scheduledAt,
  localStream,
  micOn,
  cameraOn,
  isPreparing,
  isStarting,
  error,
  onPrepare,
  onEnter,
  onToggleMic,
  onToggleCamera,
}: PreCallLobbyProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Antes de entrar</CardTitle>
        <CardDescription>
          Atendimento com {counterpartLabel}
          {scheduledAt
            ? ` · ${formatDateTimeWithContext(scheduledAt)}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <DevicePreview stream={localStream} />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={localStream && micOn ? "success" : "neutral"}>
            {localStream && micOn ? (
              <Mic aria-hidden="true" className="size-3.5" />
            ) : (
              <MicOff aria-hidden="true" className="size-3.5" />
            )}
            {localStream ? (micOn ? "Microfone ativo" : "Microfone desativado") : "Microfone"}
          </Badge>
          <Badge variant={localStream && cameraOn ? "success" : "neutral"}>
            {localStream && cameraOn ? (
              <Camera aria-hidden="true" className="size-3.5" />
            ) : (
              <CameraOff aria-hidden="true" className="size-3.5" />
            )}
            {localStream ? (cameraOn ? "Câmera ativa" : "Câmera desativada") : "Câmera"}
          </Badge>
        </div>

        {error ? (
          <Alert variant="error" title="Não foi possível acessar os dispositivos">
            <div className="flex flex-col items-start gap-3">
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={onPrepare}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        ) : null}

        {localStream ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              data-testid="lobby-toggle-mic"
              aria-pressed={micOn}
              aria-label={micOn ? "Desativar microfone" : "Ativar microfone"}
              onClick={onToggleMic}
            >
              {micOn ? (
                <Mic aria-hidden="true" />
              ) : (
                <MicOff aria-hidden="true" />
              )}
              {micOn ? "Microfone" : "Sem áudio"}
            </Button>
            <Button
              variant="secondary"
              size="md"
              data-testid="lobby-toggle-camera"
              aria-pressed={cameraOn}
              aria-label={cameraOn ? "Desativar câmera" : "Ativar câmera"}
              onClick={onToggleCamera}
            >
              {cameraOn ? (
                <Camera aria-hidden="true" />
              ) : (
                <CameraOff aria-hidden="true" />
              )}
              {cameraOn ? "Câmera" : "Sem vídeo"}
            </Button>
          </div>
        ) : null}

        <Alert variant="info" title="Privacidade do atendimento">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            O áudio e o vídeo são transmitidos apenas entre os participantes
            desta consulta.
          </span>
        </Alert>

        <div className="flex flex-wrap items-center gap-3">
          {!localStream ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={onPrepare}
              disabled={isPreparing || isStarting}
            >
              {isPreparing ? "Verificando..." : "Testar câmera e microfone"}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="lg"
              onClick={onPrepare}
              disabled={isPreparing || isStarting}
            >
              {isPreparing ? "Verificando..." : "Refazer teste"}
            </Button>
          )}
          <Button
            size="lg"
            onClick={onEnter}
            disabled={isStarting}
            data-testid="enter-room"
          >
            {isStarting ? "Conectando..." : "Entrar na sala"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
