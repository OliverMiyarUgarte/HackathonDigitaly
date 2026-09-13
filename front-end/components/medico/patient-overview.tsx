"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppointmentStatusBadge } from "@/components/paciente/appointment-status-badge";
import {
  ErrorState,
  ListSkeleton,
  LoadingIndicator,
  PageHeader,
} from "@/components/paciente/section-states";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError, get } from "@/lib/api";
import {
  appointmentSchema,
  doctorAppointmentSchema,
  patientOverviewSchema,
  preConsultAnswerListSchema,
} from "@/lib/contracts";
import { formatDate, formatDateTimeWithContext } from "@/lib/format";
import { useAsyncWithKey } from "@/lib/hooks";
import { PreConsultList } from "./pre-consult-list";
import { StartConsultationAction } from "./start-consultation-action";

export interface PatientOverviewProps {
  patientId: string;
  appointmentId: string | null;
}

export function PatientOverview({
  patientId,
  appointmentId,
}: PatientOverviewProps) {
  const overviewState = useAsyncWithKey(
    () => get(`/patients/${patientId}/overview`, patientOverviewSchema),
    patientId,
  );

  const appointmentState = useAsyncWithKey(
    () =>
      appointmentId
        ? get(`/appointments/${appointmentId}`, appointmentSchema)
        : Promise.resolve(null),
    appointmentId ?? "",
  );

  const preConsultState = useAsyncWithKey(
    () =>
      appointmentId
        ? get(
            `/appointments/${appointmentId}/pre-consult`,
            preConsultAnswerListSchema,
          )
        : Promise.resolve([]),
    appointmentId ?? "",
  );

  if (overviewState.loading) {
    return <ListSkeleton items={3} />;
  }

  if (overviewState.error instanceof ApiError && overviewState.error.status === 403) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Paciente</h1>
        <Alert variant="warning" title="Sem vínculo com este paciente">
          Você não possui atendimentos com este paciente e, por isso, não pode
          acessar o prontuário. O acesso a dados de saúde só é permitido a
          profissionais com vínculo de atendimento, conforme a LGPD.
        </Alert>
      </div>
    );
  }

  if (overviewState.error || !overviewState.data) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Paciente</h1>
        <ErrorState
          title="Não foi possível carregar o paciente"
          description="Os dados do paciente não puderam ser carregados. Tente novamente."
          onRetry={overviewState.reload}
        />
      </div>
    );
  }

  const overview = overviewState.data;
  const selectedAppointment = appointmentState.data;
  const preConsult = appointmentId
    ? preConsultState.data ?? []
    : overview.preConsult;
  const selectedDto =
    selectedAppointment && overview
      ? doctorAppointmentSchema.parse({
          appointmentId: selectedAppointment.id,
          scheduledAt: selectedAppointment.scheduledAt,
          status: selectedAppointment.status,
          patient: {
            id: overview.patient.id,
            name: overview.patient.name,
            role: overview.patient.role,
            specialty: overview.patient.specialty,
          },
          consultationId: null,
          hasPreConsult: (preConsultState.data ?? []).length > 0,
        })
      : null;

  return (
    <div className="flex flex-col gap-6" data-testid="patient-overview">
      <PageHeader
        title={overview.patient.name}
        description="Visão geral do paciente, pré-consulta e histórico de registros médicos."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identificação</CardTitle>
          <CardDescription>
            Informações mínimas usadas para identificar o paciente no
            atendimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={overview.patient.name} size="lg" />
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-base font-medium text-texto">
                <UserRound
                  aria-hidden="true"
                  className="size-4 text-accent"
                />
                {overview.patient.name}
              </span>
              <span className="inline-flex items-center gap-2 text-sm text-texto-2">
                <Mail aria-hidden="true" className="size-4 text-texto-3" />
                {overview.patient.email}
              </span>
              <span className="font-data text-xs text-texto-3">
                Cadastro em {formatDate(overview.patient.createdAt)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {appointmentId ? (
        <Card data-testid="selected-appointment">
          <CardHeader>
            <CardTitle className="text-lg">Atendimento selecionado</CardTitle>
            <CardDescription>
              Contexto do atendimento aberto a partir da agenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {appointmentState.loading ? (
              <LoadingIndicator label="Carregando atendimento" />
            ) : appointmentState.error || !selectedAppointment ? (
              <p className="text-sm text-texto-2">
                Não foi possível carregar este atendimento. Abra-o novamente
                pela agenda.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <AppointmentStatusBadge status={selectedAppointment.status} />
                  <span className="inline-flex items-center gap-2 font-data text-sm text-texto">
                    <CalendarClock
                      aria-hidden="true"
                      className="size-4 text-texto-3"
                    />
                    {formatDateTimeWithContext(selectedAppointment.scheduledAt)}
                  </span>
                </div>
                {selectedDto && selectedAppointment.status === "confirmed" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <StartConsultationAction
                      appointment={selectedDto}
                      onChanged={() => {
                        void appointmentState.reload();
                        void overviewState.reload();
                      }}
                    />
                    <Link
                      href="/medico/atendimentos"
                      className={buttonClasses({ variant: "ghost" })}
                    >
                      Ir para a agenda
                    </Link>
                  </div>
                ) : selectedAppointment.status === "in_progress" ? (
                  <Alert variant="info" title="Atendimento em andamento">
                    <div className="flex flex-col items-start gap-3">
                      <span>
                        A sala deste atendimento já está aberta. Entre por ela
                        para continuar.
                      </span>
                      <Link
                        href="/medico/atendimentos"
                        className={buttonClasses({
                          variant: "secondary",
                          size: "sm",
                        })}
                      >
                        Abrir agenda
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </div>
                  </Alert>
                ) : (
                  <p className="text-sm text-texto-2">
                    Este atendimento não está disponível para início. Confira o
                    status na agenda.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próxima consulta</CardTitle>
            <CardDescription>
              Atendimento mais próximo registrado para o paciente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.upcomingAppointment ? (
              <div className="flex flex-col gap-3">
                <AppointmentStatusBadge
                  status={overview.upcomingAppointment.status}
                />
                <p className="inline-flex items-center gap-2 font-data text-sm text-texto">
                  <CalendarClock
                    aria-hidden="true"
                    className="size-4 text-texto-3"
                  />
                  {formatDateTimeWithContext(
                    overview.upcomingAppointment.scheduledAt,
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-texto-2">
                Nenhuma consulta agendada no momento.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Respostas da pré-consulta
            </CardTitle>
            <CardDescription>
              Informações compartilhadas pelo paciente antes do atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {preConsultState.loading ? (
              <LoadingIndicator label="Carregando respostas" />
            ) : (
              <PreConsultList
                answers={preConsult}
                emptyMessage="Nenhuma resposta de pré-consulta registrada para este atendimento."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">Histórico médico</CardTitle>
              <CardDescription>
                Registros criados após os atendimentos deste paciente.
              </CardDescription>
            </div>
            <Link
              href={`/medico/prontuario?patientId=${patientId}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Ver todo o histórico
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {overview.history.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum registro médico"
              description="Quando um atendimento for documentado, o registro aparece aqui."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-borda">
              {overview.history.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-data text-sm text-texto">
                      {formatDate(record.createdAt)}
                    </span>
                    <span className="text-sm text-texto-2">
                      {record.diagnosis ?? "Sem diagnóstico registrado"}
                    </span>
                  </div>
                  <Link
                    href={`/medico/prontuario/${record.id}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    Abrir prontuário
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card variant="solid">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck
              aria-hidden="true"
              className="size-5 text-accent"
            />
            <CardTitle className="text-lg">Privacidade e auditoria</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-texto-2">
          <p className="max-w-[68ch]">
            Dados de saúde são informações sensíveis tratadas com base na
            prestação de serviços de saúde, conforme a LGPD.
          </p>
          <p className="inline-flex items-center gap-2">
            <Lock aria-hidden="true" className="size-4 text-texto-3" />
            Cada acesso a este prontuário é registrado para auditoria e
            limitado a profissionais com vínculo de atendimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
