"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { UserRole } from "@telemed/service-contracts";
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
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { get, post } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  appointmentSchema,
  attachmentSchema,
  consultationSchema,
  doctorSummaryDtoSchema,
  endConsultationResponseSchema,
  userDtoSchema,
} from "@/lib/contracts";
import { useAsync } from "@/lib/hooks";
import { useCopilot } from "@/lib/realtime/use-copilot";
import { useAudioStream } from "@/lib/realtime/use-audio-stream";
import { useConsultationRoom } from "@/lib/realtime/use-consultation-room";
import { AttachmentPanel } from "./attachment-panel";
import { CallControls } from "./call-controls";
import { CopilotPanel } from "./copilot-panel";
import { VideoStage } from "./video-stage";

const attachmentListSchema = z.array(attachmentSchema);
const doctorListSchema = z.array(doctorSummaryDtoSchema);

export interface ConsultationRoomProps {
  consultationId: string;
  appointmentId: string;
  role: UserRole;
}

export function ConsultationRoom({
  consultationId,
  appointmentId,
  role,
}: ConsultationRoomProps) {
  const router = useRouter();
  const { user } = useSession();
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const roomData = useAsync(async () => {
    const [consultation, appointment] = await Promise.all([
      get(`/consultations/${consultationId}`, consultationSchema),
      get(`/appointments/${appointmentId}`, appointmentSchema),
    ]);
    let counterpartName: string | null = null;
    try {
      if (role === "doctor") {
        const patient = await get(
          `/users/patients/${appointment.patientId}`,
          userDtoSchema,
        );
        counterpartName = patient.name;
      } else {
        const doctors = await get("/users/doctors", doctorListSchema);
        counterpartName =
          doctors.find((doctor) => doctor.id === appointment.doctorId)?.name ??
          null;
      }
    } catch {
      counterpartName = null;
    }
    return { consultation, appointment, counterpartName };
  }, null);

  const attachmentsState = useAsync(
    () =>
      get(
        `/appointments/${appointmentId}/attachments`,
        attachmentListSchema,
      ),
    null,
  );

  const room = useConsultationRoom({
    consultationId,
    appointmentId,
    role,
  });

  const copilot = useCopilot(
    consultationId,
    role === "doctor" && room.hasStarted,
  );
  const audio = useAudioStream({
    consultationId,
    stream: room.localStream,
  });

  useEffect(() => {
    if (!room.hasStarted) {
      return;
    }
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [room.hasStarted]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback((): void => {
    if (typeof document === "undefined") {
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void stageRef.current?.requestFullscreen();
  }, []);

  const handleEnd = useCallback(async (): Promise<void> => {
    setConfirmOpen(false);
    room.stop();
    if (role === "doctor") {
      setEnding(true);
      try {
        await post(
          `/consultations/${consultationId}/end`,
          undefined,
          endConsultationResponseSchema,
        );
      } catch {
        setEnding(false);
      }
    }
    router.push(role === "doctor" ? "/medico" : "/paciente");
  }, [consultationId, role, room, router]);

  const names = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (user) {
      map[user.id] = user.name;
    }
    const data = roomData.data;
    if (data) {
      const counterpartId =
        role === "doctor" ? data.appointment.patientId : data.appointment.doctorId;
      map[counterpartId] =
        data.counterpartName ?? (role === "doctor" ? "Paciente" : "Médico");
    }
    return map;
  }, [user, roomData.data, role]);

  const remoteTracks = room.remoteStream?.getVideoTracks().length ?? 0;
  const counterpartLabel =
    roomData.data?.counterpartName ??
    (role === "doctor" ? "Paciente" : "Médico");
  const consultationStatus = roomData.data?.consultation.status ?? "active";

  if (roomData.loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-video w-full" />
      </div>
    );
  }

  if (roomData.error || !roomData.data) {
    return (
      <Alert variant="error" title="Atendimento indisponível">
        Não foi possível carregar os dados deste atendimento. Volte à página
        inicial e tente novamente.
      </Alert>
    );
  }

  return (
    <div
      data-testid="consultation-room"
      data-connection-state={room.connectionState}
      data-remote-tracks={remoteTracks}
      data-role={role}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-medium text-texto">
            Atendimento com {counterpartLabel}
          </h2>
          <p className="text-sm text-texto-2">
            {role === "doctor"
              ? "Conduza a consulta com apoio do copiloto."
              : "Mantenha a câmera e o microfone ativos para a consulta."}
          </p>
        </div>
        <Badge variant={consultationStatus === "active" ? "success" : "neutral"}>
          {consultationStatus === "active" ? "Em andamento" : "Encerrado"}
        </Badge>
      </header>

      {!room.hasStarted ? (
        <Card>
          <CardHeader>
            <CardTitle>Entrar no atendimento</CardTitle>
            <CardDescription>
              Ao entrar, o navegador pedirá acesso à câmera e ao microfone. A
              permissão é solicitada apenas quando você clicar no botão.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="info" title="Privacidade do atendimento">
              O áudio e o vídeo são transmitidos apenas entre os participantes
              desta consulta. A captura para o copiloto só é ativada pelo
              médico.
            </Alert>
            {room.error ? (
              <Alert variant="error" title="Não foi possível entrar">
                <div className="flex flex-col items-start gap-3">
                  <span>{room.error}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void room.retry()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </Alert>
            ) : null}
            <div>
              <Button
                size="lg"
                onClick={() => void room.start()}
                disabled={room.isStarting}
                data-testid="enter-room"
              >
                {room.isStarting ? "Conectando..." : "Entrar no atendimento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="flex flex-col gap-4">
            {room.error ? (
              <Alert variant="error" title="Conexão">
                <div className="flex flex-col items-start gap-3">
                  <span>{room.error}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void room.retry()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </Alert>
            ) : null}
            <VideoStage
              stageRef={stageRef}
              localStream={room.localStream}
              remoteStream={room.remoteStream}
              participants={room.participants}
              names={names}
              connectionState={room.connectionState}
              elapsedSeconds={elapsedSeconds}
            />
            <CallControls
              micOn={room.micOn}
              cameraOn={room.cameraOn}
              attachmentsOpen={attachmentsOpen}
              isFullscreen={isFullscreen}
              ending={ending}
              onToggleMic={room.toggleMic}
              onToggleCamera={room.toggleCamera}
              onToggleAttachments={() => setAttachmentsOpen((open) => !open)}
              onToggleFullscreen={toggleFullscreen}
              onEndCall={() => setConfirmOpen(true)}
            />
          </div>

          <div className="flex flex-col gap-4">
            {role === "doctor" ? (
              <CopilotPanel
                partial={copilot.partial}
                segments={copilot.segments}
                insights={copilot.insights}
                aiStatus={copilot.aiStatus}
                isStreaming={audio.isStreaming}
                level={audio.level}
                audioError={audio.error}
                onStartAudio={() => void audio.start()}
                onStopAudio={audio.stop}
                onClear={copilot.clear}
              />
            ) : null}

            {attachmentsOpen ? (
              <AttachmentPanel
                appointmentId={appointmentId}
                consultationId={consultationId}
                attachments={attachmentsState.data ?? []}
                loading={attachmentsState.loading}
                onUploaded={() => attachmentsState.reload()}
              />
            ) : null}
          </div>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Encerrar atendimento"
        description="O atendimento será finalizado para todos os participantes."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={ending}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleEnd()}
              disabled={ending}
            >
              {ending ? "Encerrando..." : "Encerrar"}
            </Button>
          </>
        }
      />
    </div>
  );
}
