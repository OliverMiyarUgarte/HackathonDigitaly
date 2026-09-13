"use client";

import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Paperclip,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CallControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  attachmentsOpen: boolean;
  isFullscreen: boolean;
  ending: boolean;
  endLabel?: string;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleAttachments: () => void;
  onToggleFullscreen: () => void;
  onEndCall: () => void;
}

export function CallControls({
  micOn,
  cameraOn,
  attachmentsOpen,
  isFullscreen,
  ending,
  endLabel = "Encerrar teleatendimento",
  onToggleMic,
  onToggleCamera,
  onToggleAttachments,
  onToggleFullscreen,
  onEndCall,
}: CallControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Controles da chamada"
      className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-borda bg-bg-elev p-3"
    >
      <Button
        variant="secondary"
        size="md"
        data-testid="toggle-mic"
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
        data-testid="toggle-camera"
        aria-pressed={cameraOn}
        aria-label={cameraOn ? "Desativar câmera" : "Ativar câmera"}
        onClick={onToggleCamera}
      >
        {cameraOn ? (
          <Video aria-hidden="true" />
        ) : (
          <VideoOff aria-hidden="true" />
        )}
        {cameraOn ? "Câmera" : "Sem vídeo"}
      </Button>

      <Button
        variant="secondary"
        size="md"
        data-testid="toggle-attachments"
        aria-pressed={attachmentsOpen}
        aria-controls="attachment-panel"
        onClick={onToggleAttachments}
      >
        <Paperclip aria-hidden="true" />
        Anexos
      </Button>

      <Button
        variant="secondary"
        size="md"
        data-testid="toggle-fullscreen"
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? (
          <Minimize2 aria-hidden="true" />
        ) : (
          <Maximize2 aria-hidden="true" />
        )}
        {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      </Button>

      <Button
        variant="primary"
        size="md"
        data-testid="end-call"
        onClick={onEndCall}
        disabled={ending}
      >
        <PhoneOff aria-hidden="true" />
        {ending ? "Encerrando..." : endLabel}
      </Button>
    </div>
  );
}
