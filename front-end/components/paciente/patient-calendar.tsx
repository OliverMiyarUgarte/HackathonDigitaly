"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Stethoscope,
  Video,
} from "lucide-react";
import { AppointmentStatusBadge } from "@/components/paciente/appointment-status-badge";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/paciente/section-states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses, Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError, get, post } from "@/lib/api";
import {
  appointmentSchema,
  calendarEntrySchema,
  type CalendarEntryDto,
} from "@/lib/contracts";
import {
  addMonthsToAnchor,
  anchorMonthRange,
  buildMonthMatrix,
  formatMonthLabel,
  isCancellable,
  monthAnchorFor,
  splitCalendarEntries,
  toSaoPauloDateKey,
  WEEKDAY_LABELS,
} from "@/lib/appointments";
import {
  formatDate,
  formatDateTimeWithContext,
  formatTime,
} from "@/lib/format";
import { useAsyncWithKey, useToast } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const calendarListSchema = z.array(calendarEntrySchema);

export function PatientCalendar() {
  const { toast } = useToast();
  const [anchor, setAnchor] = useState(() => monthAnchorFor(new Date()));
  const [cancelTarget, setCancelTarget] = useState<CalendarEntryDto | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const state = useAsyncWithKey(() => {
    const range = anchorMonthRange(anchor);
    return get(
      `/appointments/calendar?from=${encodeURIComponent(
        range.from,
      )}&to=${encodeURIComponent(range.to)}`,
      calendarListSchema,
    );
  }, anchor);

  const entries = useMemo(
    () => (state.loading ? [] : state.data ?? []),
    [state.loading, state.data],
  );
  const weeks = useMemo(() => buildMonthMatrix(anchor), [anchor]);
  const { upcoming, previous } = useMemo(
    () => splitCalendarEntries(entries),
    [entries],
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntryDto[]>();
    for (const entry of entries) {
      const key = toSaoPauloDateKey(entry.scheduledAt);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const currentDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (entry.isCurrent) {
        set.add(toSaoPauloDateKey(entry.scheduledAt));
      }
    }
    return set;
  }, [entries]);

  const handleCancel = async (): Promise<void> => {
    if (!cancelTarget) {
      return;
    }
    setCancelling(true);
    try {
      await post(
        `/appointments/${cancelTarget.appointmentId}/cancel`,
        {},
        appointmentSchema,
      );
      setCancelTarget(null);
      toast({
        variant: "success",
        title: "Consulta cancelada",
        description: "O horário foi liberado e o calendário foi atualizado.",
      });
      state.reload();
    } catch (error) {
      const message =
        error instanceof ApiError && error.code === "APPOINTMENT_TERMINAL"
          ? "Este atendimento já foi concluído ou cancelado e não pode ser alterado."
          : "Não foi possível cancelar a consulta. Tente novamente.";
      toast({ variant: "error", title: "Falha ao cancelar", description: message });
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const renderEntry = (entry: CalendarEntryDto) => {
    const inProgress = entry.status === "in_progress" && entry.consultationId;
    return (
      <li
        key={entry.appointmentId}
        data-testid={`calendar-entry-${entry.appointmentId}`}
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-bg-elev p-4",
          entry.isCurrent
            ? "border-celeste-500 ring-1 ring-celeste-500"
            : "border-borda",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-texto">
              {entry.counterpart.name}
            </span>
            {entry.isCurrent ? (
              <Badge variant="brand" live>
                Atual
              </Badge>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-texto-2">
            <Stethoscope aria-hidden="true" className="size-3.5" />
            {entry.counterpart.specialty ?? "Especialidade não informada"}
          </span>
          <span className="inline-flex items-center gap-2 font-data text-xs text-texto-3">
            <Clock aria-hidden="true" className="size-3.5" />
            {formatDateTimeWithContext(entry.scheduledAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AppointmentStatusBadge status={entry.status} />
          {inProgress && entry.consultationId ? (
            <Link
              href={`/paciente/consultas/${entry.consultationId}`}
              className={buttonClasses({ size: "sm" })}
            >
              <Video aria-hidden="true" />
              Entrar na sala
            </Link>
          ) : null}
          {entry.status === "pending_code" ? (
            <Link
              href={`/paciente/confirmar-agendamento?appointmentId=${entry.appointmentId}`}
              className={buttonClasses({ size: "sm", variant: "secondary" })}
            >
              Confirmar
            </Link>
          ) : null}
          {entry.status === "completed" && entry.consultationId ? (
            <Link
              href={`/paciente/consultas/${entry.consultationId}`}
              className={buttonClasses({ size: "sm", variant: "ghost" })}
            >
              Ver resumo
              <ExternalLink aria-hidden="true" />
            </Link>
          ) : null}
          {isCancellable(entry.status) && !inProgress ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCancelTarget(entry)}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendário"
        description="Visualize o mês, acompanhe as próximas consultas e confirme ou cancele horários."
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">
            {formatMonthLabel(anchor)}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Mês anterior"
              onClick={() =>
                setAnchor((current) => addMonthsToAnchor(current, -1))
              }
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAnchor(monthAnchorFor(new Date()))}
            >
              Hoje
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Próximo mês"
              onClick={() =>
                setAnchor((current) => addMonthsToAnchor(current, 1))
              }
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="py-2 text-xs font-medium text-texto-3"
              >
                {label}
              </span>
            ))}
            {weeks.flat().map((cell, index) => {
              if (!cell.key || !cell.day) {
                return <span key={`empty-${index}`} aria-hidden="true" />;
              }
              const dayEntries = entriesByDay.get(cell.key) ?? [];
              const isCurrent = currentDayKeys.has(cell.key);
              return (
                <div
                  key={cell.key}
                  className={cn(
                    "flex min-h-16 flex-col items-center gap-1 rounded-md border p-1.5 text-xs",
                    isCurrent
                      ? "border-celeste-500 bg-celeste-500/10"
                      : "border-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "font-data",
                      isCurrent ? "text-accent" : "text-texto-2",
                    )}
                  >
                    {cell.day}
                  </span>
                  {dayEntries.length > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-pill bg-celeste-500/14 px-2 py-0.5 font-data text-xs text-accent"
                      aria-label={`${dayEntries.length} consulta(s)`}
                    >
                      <CalendarDays aria-hidden="true" className="size-3" />
                      {dayEntries.length}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {state.loading ? (
        <ListSkeleton items={3} />
      ) : state.error ? (
        <ErrorState
          title="Não foi possível carregar o calendário"
          description="Sua agenda não pôde ser carregada. Tente novamente."
          onRetry={state.reload}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma consulta neste mês"
          description="Navegue para outro mês ou agende uma nova teleconsulta."
          action={
            <Link
              href="/paciente/agendar"
              className={buttonClasses({ variant: "primary" })}
            >
              Agendar consulta
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Próximas consultas" className="flex flex-col gap-3">
            <h2 className="text-xl font-medium text-texto">Próximas</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-texto-2">
                Nenhuma consulta futura neste mês.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcoming.map(renderEntry)}
              </ul>
            )}
          </section>

          <section
            aria-label="Consultas anteriores"
            className="flex flex-col gap-3"
          >
            <h2 className="text-xl font-medium text-texto">Anteriores</h2>
            {previous.length === 0 ? (
              <p className="text-sm text-texto-2">
                Nenhuma consulta anterior neste mês.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {previous.map(renderEntry)}
              </ul>
            )}
          </section>
        </div>
      )}

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
          }
        }}
        title="Cancelar consulta"
        description={
          cancelTarget
            ? `Confirme o cancelamento da consulta de ${formatDate(
                cancelTarget.scheduledAt,
              )} às ${formatTime(cancelTarget.scheduledAt)} com ${
                cancelTarget.counterpart.name
              }.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Manter consulta
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCancel()}
              disabled={cancelling}
              data-testid="confirm-cancel"
            >
              {cancelling ? "Cancelando..." : "Cancelar consulta"}
            </Button>
          </>
        }
      >
        <Alert variant="warning" title="Esta ação libera o horário">
          O médico será notificado e o horário volta a ficar disponível para
          outros pacientes.
        </Alert>
      </Dialog>
    </div>
  );
}
