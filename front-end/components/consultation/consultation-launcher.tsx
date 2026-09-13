"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { CalendarClock, Stethoscope } from "lucide-react";
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
import { get, post } from "@/lib/api";
import {
  doctorAppointmentSchema,
  startConsultationResponseSchema,
  type DoctorAppointmentDto,
  type UserRole,
} from "@/lib/contracts";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

const doctorAppointmentsSchema = z.array(doctorAppointmentSchema);

function selectAppointment(
  appointments: DoctorAppointmentDto[],
): DoctorAppointmentDto | null {
  const inProgress = appointments.find(
    (appointment) =>
      appointment.status === "in_progress" && appointment.consultationId,
  );
  if (inProgress) {
    return inProgress;
  }
  return (
    appointments.find(
      (appointment) =>
        appointment.status === "confirmed" && appointment.consultationId === null,
    ) ?? null
  );
}

export function ConsultationLauncher({ role }: { role: UserRole }) {
  const router = useRouter();
  const isDoctor = role === "doctor";
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const state = useAsync<DoctorAppointmentDto[]>(
    () =>
      isDoctor
        ? get("/appointments/doctor", doctorAppointmentsSchema)
        : Promise.resolve([]),
    [],
  );

  if (!isDoctor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sala de atendimento</CardTitle>
          <CardDescription>
            Quando o médico iniciar a teleconsulta, um aviso aparece aqui com o
            atalho para entrar na sala.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge variant="outline">Aguardando início</Badge>
        </CardContent>
      </Card>
    );
  }

  const appointment = state.data ? selectAppointment(state.data) : null;
  const isInProgress = appointment?.status === "in_progress";

  const handleStart = async (): Promise<void> => {
    if (!appointment) {
      return;
    }
    setStarting(true);
    setActionError(null);
    try {
      const result = await post(
        `/appointments/${appointment.appointmentId}/consultations/start`,
        undefined,
        startConsultationResponseSchema,
      );
      router.push(`/medico/consultas/${result.consultationId}`);
    } catch {
      setActionError(
        "Não foi possível iniciar o atendimento. Atualize a página e tente novamente.",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sala de atendimento</CardTitle>
        <CardDescription>
          Inicie a teleconsulta e conduza o atendimento com o copiloto.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.loading ? (
          <p className="text-sm text-texto-3">Carregando atendimentos...</p>
        ) : null}

        {!state.loading && !appointment ? (
          <p className="text-sm text-texto-2">
            Nenhum atendimento confirmado disponível no momento.
          </p>
        ) : null}

        {appointment ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Stethoscope aria-hidden="true" className="size-4 text-celeste-500" />
                <p className="text-sm font-medium text-texto">
                  {appointment.patient.name}
                </p>
                <Badge variant={isInProgress ? "success" : "brand"} live={isInProgress}>
                  {isInProgress ? "Em andamento" : "Confirmado"}
                </Badge>
              </div>
              <span className="flex items-center gap-2 font-data text-xs text-texto-3">
                <CalendarClock aria-hidden="true" className="size-3.5" />
                {formatDateTime(appointment.scheduledAt)}
              </span>
            </div>
            {isInProgress && appointment.consultationId ? (
              <Button
                data-testid="join-consultation"
                onClick={() =>
                  router.push(`/medico/consultas/${appointment.consultationId}`)
                }
              >
                Entrar na sala
              </Button>
            ) : (
              <Button
                data-testid="start-consultation"
                onClick={() => void handleStart()}
                disabled={starting}
              >
                {starting ? "Iniciando..." : "Iniciar atendimento"}
              </Button>
            )}
          </div>
        ) : null}

        {actionError ? (
          <Alert variant="error" title="Atendimento">
            {actionError}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
