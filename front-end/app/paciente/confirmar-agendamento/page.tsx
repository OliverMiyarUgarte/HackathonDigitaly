"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { ConfirmAppointment } from "@/components/paciente/confirm-appointment";
import { SessionLoading } from "@/lib/auth";

function ConfirmAppointmentContent() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  if (!appointmentId) {
    return (
      <Alert variant="warning" title="Agendamento não informado">
        Volte ao calendário, selecione um agendamento pendente e confirme o
        horário para continuar.
      </Alert>
    );
  }

  return <ConfirmAppointment appointmentId={appointmentId} />;
}

export default function PacienteConfirmarAgendamentoPage() {
  return (
    <Suspense fallback={<SessionLoading label="Carregando agendamento" />}>
      <ConfirmAppointmentContent />
    </Suspense>
  );
}
