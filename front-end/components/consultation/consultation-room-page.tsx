"use client";

import type { UserRole } from "@telemed/service-contracts";
import { Alert } from "@/components/ui/alert";
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

  return (
    <ConsultationRoom
      consultationId={consultationId}
      appointmentId={state.data.appointmentId}
      role={role}
    />
  );
}
