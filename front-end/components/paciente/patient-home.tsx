"use client";

import Link from "next/link";
import { z } from "zod";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  ExternalLink,
  Stethoscope,
  Video,
} from "lucide-react";
import { AppointmentStatusBadge } from "@/components/paciente/appointment-status-badge";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/paciente/section-states";
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
import {
  calendarEntrySchema,
  consultationHistoryItemSchema,
} from "@/lib/contracts";
import {
  formatDate,
  formatDateTimeWithContext,
} from "@/lib/format";
import { pickNextAppointment } from "@/lib/appointments";
import { useAsync } from "@/lib/hooks";

const calendarListSchema = z.array(calendarEntrySchema);
const historyListSchema = z.array(consultationHistoryItemSchema);

const QUICK_ACTIONS = [
  {
    href: "/paciente/agendar",
    title: "Agendar consulta",
    description: "Escolha especialidade, médico e horário.",
    Icon: CalendarPlus,
  },
  {
    href: "/paciente/calendario",
    title: "Calendário",
    description: "Veja compromissos e confirme presença.",
    Icon: CalendarDays,
  },
  {
    href: "/paciente/historico",
    title: "Histórico",
    description: "Reveja atendimentos e orientações.",
    Icon: ClipboardList,
  },
] as const;

function firstName(name: string | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "Paciente";
}

export function PatientHome() {
  const { user } = useSession();

  const calendarState = useAsync(() =>
    get(
      `/appointments/calendar?from=${encodeURIComponent(
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      )}&to=${encodeURIComponent(
        new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      )}`,
      calendarListSchema,
    ),
  );

  const historyState = useAsync(() =>
    get("/consultations/mine", historyListSchema),
  );

  const entries = calendarState.data ?? [];
  const next = pickNextAppointment(entries);
  const recent = (historyState.data ?? []).slice(0, 3);
  const isInProgress = next?.status === "in_progress" && next.consultationId;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Olá, ${firstName(user?.name)}`}
        description="Acompanhe sua próxima consulta, confirme o agendamento e entre na sala quando o médico iniciar."
        action={
          <Link
            href="/paciente/agendar"
            className={buttonClasses({ variant: "secondary" })}
          >
            <CalendarPlus aria-hidden="true" />
            Agendar consulta
          </Link>
        }
      />

      <section aria-label="Próxima consulta">
        {calendarState.loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-10 w-48 rounded-pill" />
            </CardContent>
          </Card>
        ) : calendarState.error ? (
          <ErrorState
            title="Não foi possível carregar sua agenda"
            description="Sua próxima consulta não pôde ser carregada. Tente novamente."
            onRetry={calendarState.reload}
          />
        ) : !next ? (
          <EmptyState
            icon={CalendarPlus}
            title="Nenhuma consulta agendada"
            description="Agende sua primeira teleconsulta. Você escolhe o médico e o horário e confirma com um código por e-mail."
            action={
              <Link
                href="/paciente/agendar"
                className={buttonClasses({ variant: "primary" })}
              >
                Agendar consulta
                <ArrowRight aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <Card variant={isInProgress ? "feature" : "solid"}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={isInProgress ? "outline" : "brand"}
                  className={isInProgress ? "border-white/40 text-white" : undefined}
                >
                  {isInProgress ? "Consulta em andamento" : "Próxima consulta"}
                </Badge>
                <AppointmentStatusBadge status={next.status} />
              </div>
              <CardTitle className={isInProgress ? "text-white" : undefined}>
                {isInProgress
                  ? `${next.counterpart.name} está aguardando você`
                  : "Sua próxima teleconsulta"}
              </CardTitle>
              <CardDescription
                className={isInProgress ? "text-white/80" : undefined}
              >
                {isInProgress
                  ? "Entre na sala para participar do atendimento agora."
                  : "Confira os detalhes e prepare-se para o atendimento."}
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
                  {next.counterpart.name} ·{" "}
                  {next.counterpart.specialty ?? "Especialidade não informada"}
                </span>
              </div>

              {isInProgress && next.consultationId ? (
                <Link
                  href={`/paciente/consultas/${next.consultationId}`}
                  className={buttonClasses({
                    variant: "glass",
                    className: "w-fit",
                  })}
                >
                  <Video aria-hidden="true" />
                  Entrar na consulta
                </Link>
              ) : next.status === "pending_code" ? (
                <Link
                  href={`/paciente/confirmar-agendamento?appointmentId=${next.appointmentId}`}
                  className={buttonClasses({ className: "w-fit" })}
                >
                  Confirmar agendamento
                  <ArrowRight aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  href="/paciente/calendario"
                  className={buttonClasses({
                    variant: "secondary",
                    className: "w-fit",
                  })}
                >
                  Ver no calendário
                  <ArrowRight aria-hidden="true" />
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-label="Ações rápidas" className="flex flex-col gap-3">
        <h3 className="text-lg font-medium text-texto">Ações rápidas</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-lg border border-borda bg-bg-elev p-5 transition-colors hover:border-celeste-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-celeste-500/14 text-celeste-500">
                <action.Icon aria-hidden="true" className="size-5" />
              </span>
              <p className="mt-3 text-base font-medium text-texto">
                {action.title}
              </p>
              <p className="mt-1 text-sm text-texto-2">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Consultas recentes" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-medium text-texto">Consultas recentes</h3>
          <Link
            href="/paciente/historico"
            className="inline-flex items-center gap-1 text-sm font-medium text-celeste-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500"
          >
            Ver histórico
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {historyState.loading ? (
          <ListSkeleton items={2} />
        ) : historyState.error ? (
          <ErrorState
            title="Não foi possível carregar o histórico"
            onRetry={historyState.reload}
          />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma consulta realizada"
            description="Quando você concluir um atendimento, o resumo aparece aqui."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {recent.map((item) => (
              <li key={item.consultationId}>
                <Link
                  href={`/paciente/consultas/${item.consultationId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda bg-bg-elev p-4 transition-colors hover:border-celeste-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-texto">
                      {item.doctor.name} ·{" "}
                      {item.doctor.specialty ?? "Especialidade não informada"}
                    </p>
                    <p className="font-data text-xs text-texto-3">
                      {formatDate(item.startedAt)}
                    </p>
                    {item.diagnosis ? (
                      <p className="text-xs text-texto-3">
                        Diagnóstico: {item.diagnosis}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.endedAt ? (
                      <Badge variant="neutral">Concluída</Badge>
                    ) : (
                      <Badge variant="success" live>
                        Em andamento
                      </Badge>
                    )}
                    <ExternalLink
                      aria-hidden="true"
                      className="size-4 text-texto-3"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
