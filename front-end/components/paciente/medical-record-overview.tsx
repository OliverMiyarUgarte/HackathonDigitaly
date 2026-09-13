"use client";

import { useMemo } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { AppointmentStatusBadge } from "@/components/paciente/appointment-status-badge";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/paciente/section-states";
import { Avatar } from "@/components/ui/avatar";
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
import { get } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  doctorSummaryDtoSchema,
  patientOverviewSchema,
} from "@/lib/contracts";
import { formatDate, formatDateTimeWithContext } from "@/lib/format";
import { preConsultLabel } from "@/lib/appointments";
import { useAsyncWithKey } from "@/lib/hooks";

const doctorListSchema = z.array(doctorSummaryDtoSchema);

export function MedicalRecordOverview() {
  const { user } = useSession();
  const patientId = user?.id ?? "";

  const overviewState = useAsyncWithKey(
    () =>
      get(`/patients/${patientId}/overview`, patientOverviewSchema),
    patientId,
  );

  const doctorsState = useAsyncWithKey(
    () => get("/users/doctors", doctorListSchema),
    "doctors",
  );

  const doctorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const doctor of doctorsState.data ?? []) {
      map.set(doctor.id, doctor.name);
    }
    return map;
  }, [doctorsState.data]);

  const overview = overviewState.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meu prontuário"
        description="Visualize seus dados cadastrais, a próxima consulta, as respostas de pré-consulta e o histórico de registros médicos."
      />

      {overviewState.loading ? (
        <ListSkeleton items={3} />
      ) : overviewState.error || !overview ? (
        <ErrorState
          title="Não foi possível carregar o prontuário"
          description="Seus dados não puderam ser carregados. Tente novamente."
          onRetry={overviewState.reload}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do paciente</CardTitle>
              <CardDescription>
                Informações mínimas usadas para identificar você no atendimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={overview.patient.name} size="lg" />
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 text-base font-medium text-texto">
                    <UserRound aria-hidden="true" className="size-4 text-celeste-500" />
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Próxima consulta</CardTitle>
                <CardDescription>
                  Dados do atendimento mais próximo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview.upcomingAppointment ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <AppointmentStatusBadge
                        status={overview.upcomingAppointment.status}
                      />
                      <Badge variant="outline">Teleconsulta</Badge>
                    </div>
                    <p className="inline-flex items-center gap-2 font-data text-sm text-texto">
                      <CalendarClock
                        aria-hidden="true"
                        className="size-4 text-texto-3"
                      />
                      {formatDateTimeWithContext(
                        overview.upcomingAppointment.scheduledAt,
                      )}
                    </p>
                    <p className="inline-flex items-center gap-2 text-sm text-texto-2">
                      <Stethoscope
                        aria-hidden="true"
                        className="size-4 text-texto-3"
                      />
                      {doctorNames.get(
                        overview.upcomingAppointment.doctorId,
                      ) ?? "Médico do atendimento"}
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
                  Informações compartilhadas apenas com o médico do atendimento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview.preConsult.length === 0 ? (
                  <p className="text-sm text-texto-2">
                    Nenhuma resposta registrada para a próxima consulta.
                  </p>
                ) : (
                  <dl className="flex flex-col gap-3">
                    {overview.preConsult.map((answer) => (
                      <div key={answer.id} className="flex flex-col gap-1">
                        <dt className="text-xs font-medium text-texto-3">
                          {preConsultLabel(answer.questionKey)}
                        </dt>
                        <dd className="text-sm text-texto">{answer.answer}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico médico</CardTitle>
              <CardDescription>
                Registros criados pelos médicos após os atendimentos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overview.history.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Nenhum registro médico"
                  description="Quando um atendimento for documentado pelo médico, o registro aparece aqui."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-borda">
                  {overview.history.map((record) => (
                    <li
                      key={record.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-2 font-data text-sm text-texto">
                          <ClipboardList
                            aria-hidden="true"
                            className="size-4 text-texto-3"
                          />
                          {formatDate(record.createdAt)}
                        </span>
                        <span className="text-sm text-texto-2">
                          {record.diagnosis ?? "Sem diagnóstico registrado"}
                        </span>
                      </div>
                      <Link
                        href={`/paciente/consultas/${record.consultationId}`}
                        className={buttonClasses({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Ver atendimento
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
                  className="size-5 text-celeste-500"
                />
                <CardTitle className="text-lg">
                  Privacidade e acesso
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-texto-2">
              <p className="max-w-[68ch]">
                Seus dados de saúde são informações sensíveis e tratados com
                base na prestação de serviços de saúde, conforme a LGPD. Este
                prontuário é somente leitura para você.
              </p>
              <p className="inline-flex items-center gap-2">
                <Lock aria-hidden="true" className="size-4 text-texto-3" />
                Apenas você e os profissionais envolvidos nos seus atendimentos
                acessam estes dados, e cada acesso é registrado para auditoria.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
