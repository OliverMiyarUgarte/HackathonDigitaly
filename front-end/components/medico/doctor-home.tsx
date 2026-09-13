"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Clock,
  FileHeart,
  Stethoscope,
} from "lucide-react";
import { AppointmentStatusBadge } from "@/components/paciente/appointment-status-badge";
import {
  ErrorState,
  PageHeader,
} from "@/components/paciente/section-states";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { get } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { formatDateKeyLabel } from "@/lib/appointments";
import { doctorAppointmentListSchema } from "@/lib/contracts";
import { formatDateTimeWithContext } from "@/lib/format";
import { useAsyncWithKey } from "@/lib/hooks";
import {
  countDoctorAppointments,
  doctorDayQuery,
  pickNextDoctorAppointment,
  todaySaoPauloKey,
} from "@/lib/medico";
import { StartConsultationAction } from "./start-consultation-action";

function firstName(name: string | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "Doutor(a)";
}

interface StatCardProps {
  label: string;
  value: number;
  context: string;
}

function StatCard({ label, value, context }: StatCardProps) {
  return (
    <Card>
      <CardContent className="mt-0 flex flex-col gap-1">
        <span className="text-sm text-texto-2">{label}</span>
        <span className="font-data text-3xl tabular-nums text-texto">
          {value}
        </span>
        <span className="text-xs text-texto-3">{context}</span>
      </CardContent>
    </Card>
  );
}

export function DoctorHome() {
  const { user } = useSession();
  const todayKey = todaySaoPauloKey();

  const agendaState = useAsyncWithKey(
    () =>
      get(
        `/appointments/doctor?date=${encodeURIComponent(doctorDayQuery(todayKey))}`,
        doctorAppointmentListSchema,
      ),
    todayKey,
  );

  const appointments = agendaState.data ?? [];
  const counts = countDoctorAppointments(appointments);
  const next = pickNextDoctorAppointment(appointments);
  const isInProgress = next?.status === "in_progress";
  const todayLabel = formatDateKeyLabel(todayKey);

  return (
    <div className="flex flex-col gap-6" data-testid="doctor-home">
      <PageHeader
        title={`Olá, ${firstName(user?.name)}`}
        description="Sua agenda de hoje e o próximo atendimento em um só lugar."
        action={
          <Link
            href="/medico/atendimentos"
            className={buttonClasses({ variant: "secondary" })}
          >
            <CalendarDays aria-hidden="true" />
            Ver agenda
          </Link>
        }
      />

      <section aria-label="Resumo do dia" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Consultas hoje"
          value={counts.total}
          context={todayLabel}
        />
        <StatCard
          label="Confirmadas"
          value={counts.confirmed}
          context="Prontas para iniciar"
        />
        <StatCard
          label="Aguardando código"
          value={counts.pendingCode}
          context="Paciente ainda não confirmou"
        />
      </section>

      <section aria-label="Próximo atendimento">
        {agendaState.loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-10 w-52 rounded-pill" />
            </CardContent>
          </Card>
        ) : agendaState.error ? (
          <ErrorState
            title="Não foi possível carregar sua agenda"
            description="Os atendimentos de hoje não puderam ser carregados. Tente novamente."
            onRetry={agendaState.reload}
          />
        ) : !next ? (
          <EmptyState
            icon={CalendarPlus}
            title="Nenhum atendimento hoje"
            description="Quando houver consultas confirmadas para hoje, elas aparecem aqui com o próximo passo."
            action={
              <Link
                href="/medico/atendimentos"
                className={buttonClasses({ variant: "primary" })}
              >
                Abrir agenda
                <ArrowRight aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <Card
            variant={isInProgress ? "feature" : "solid"}
            data-testid="doctor-next-appointment"
            data-status={next.status}
          >
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={isInProgress ? "outline" : "brand"}
                  className={
                    isInProgress ? "border-white/40 text-white" : undefined
                  }
                >
                  {isInProgress
                    ? "Atendimento em andamento"
                    : "Próximo atendimento"}
                </Badge>
                <AppointmentStatusBadge status={next.status} />
                {next.hasPreConsult ? (
                  <Badge
                    variant={isInProgress ? "outline" : "success"}
                    className={
                      isInProgress ? "border-white/40 text-white" : undefined
                    }
                  >
                    Pré-consulta respondida
                  </Badge>
                ) : (
                  <Badge
                    variant="neutral"
                    className={
                      isInProgress ? "border-white/40 text-white" : undefined
                    }
                  >
                    Sem pré-consulta
                  </Badge>
                )}
              </div>
              <CardTitle className={isInProgress ? "text-white" : undefined}>
                {next.patient.name}
              </CardTitle>
              <CardDescription
                className={isInProgress ? "text-white/80" : undefined}
              >
                {isInProgress
                  ? "O paciente aguarda na sala. Retome o atendimento."
                  : "Confira os dados do paciente e inicie a teleconsulta."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span
                  className={`inline-flex items-center gap-2 font-data text-base ${
                    isInProgress ? "text-white" : "text-texto"
                  }`}
                >
                  <Clock aria-hidden="true" className="size-4" />
                  {formatDateTimeWithContext(next.scheduledAt)}
                </span>
                <span
                  className={`inline-flex items-center gap-2 text-sm ${
                    isInProgress ? "text-white/80" : "text-texto-2"
                  }`}
                >
                  <Stethoscope aria-hidden="true" className="size-4" />
                  {next.patient.specialty ?? "Paciente de teleconsulta"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StartConsultationAction
                  appointment={next}
                  size="lg"
                  variant={isInProgress ? "glass" : "primary"}
                  onChanged={agendaState.reload}
                />
                <Link
                  href={`/medico/pacientes/${next.patient.id}?appointmentId=${next.appointmentId}`}
                  className={buttonClasses({
                    variant: isInProgress ? "glass" : "secondary",
                  })}
                >
                  <FileHeart aria-hidden="true" />
                  Ver paciente
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
