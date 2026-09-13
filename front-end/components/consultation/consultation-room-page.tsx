"use client";

import Link from "next/link";
import type { UserRole } from "@telemed/service-contracts";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { SessionLoading } from "@/lib/auth";
import { consultationSchema } from "@/lib/contracts";
import { get } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { ConsultationRoom } from "./consultation-room";
import { PostCallSummary } from "./post-call-summary";

export interface ConsultationRoomPageProps {
  consultationId: string;
  role: UserRole;
}

export function ConsultationRoomPage({
  consultationId,
  role,
}: ConsultationRoomPageProps) {
  const state = useAsync(
    () => get(`/consultations/${consultationId}`, consultationSchema),
    null,
  );

  if (state.loading) {
    return <SessionLoading label="Carregando atendimento" />;
  }

  if (state.error || !state.data) {
    return (
      <Alert variant="error" title="Atendimento indisponível">
        Não foi possível localizar esta consulta. Volte à página inicial e
        tente novamente.
      </Alert>
    );
  }

  if (role === "patient" && state.data.status === "ended") {
    return (
      <PostCallSummary
        consultationId={consultationId}
        endedAt={state.data.endedAt}
      />
    );
  }

  if (role === "doctor" && state.data.status === "ended") {
    return (
      <Alert variant="info" title="Atendimento encerrado">
        <div className="flex flex-col items-start gap-3">
          <span>
            Este atendimento foi finalizado. Continue para registrar o
            prontuário da consulta.
          </span>
          <Link
            href={`/medico/consultas/${consultationId}/fechamento`}
            className={buttonClasses({ variant: "primary" })}
          >
            Registrar prontuário
          </Link>
        </div>
      </Alert>
    );
  }

  return (
    <ConsultationRoom
      consultationId={consultationId}
      appointmentId={state.data.appointmentId}
      role={role}
    />
  );
}
