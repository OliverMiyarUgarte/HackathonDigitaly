"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Eye, FilterX, Search } from "lucide-react";
import { AppointmentStatusBadge } from "@/components/paciente/appointment-status-badge";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/paciente/section-states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { get } from "@/lib/api";
import {
  APPOINTMENT_STATUS_LABELS,
  formatDateKeyLabel,
} from "@/lib/appointments";
import {
  APPOINTMENT_STATUSES,
  doctorAppointmentListSchema,
  type AppointmentStatus,
  type DoctorAppointmentDto,
} from "@/lib/contracts";
import { formatDateTimeWithContext } from "@/lib/format";
import { useAsyncWithKey } from "@/lib/hooks";
import { doctorDayQuery, todaySaoPauloKey } from "@/lib/medico";
import { StartConsultationAction } from "./start-consultation-action";

const MAX_ROWS = 50;

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "Todos os status" },
  ...APPOINTMENT_STATUSES.map((status) => ({
    value: status,
    label: APPOINTMENT_STATUS_LABELS[status],
  })),
];

export function DoctorAgenda() {
  const [dateKey, setDateKey] = useState(todaySaoPauloKey());
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [query, setQuery] = useState("");
  const stateKey = `${dateKey}|${status}`;

  const state = useAsyncWithKey(() => {
    const params = new URLSearchParams();
    if (dateKey) {
      params.set("date", doctorDayQuery(dateKey));
    }
    if (status) {
      params.set("status", status);
    }
    const query = params.toString();
    return get(
      `/appointments/doctor${query ? `?${query}` : ""}`,
      doctorAppointmentListSchema,
    );
  }, stateKey);

  const appointments = state.data ?? [];
  const ordered = dateKey
    ? appointments
    : [...appointments].sort(
        (left, right) =>
          new Date(right.scheduledAt).getTime() -
          new Date(left.scheduledAt).getTime(),
      );
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = normalizedQuery
    ? ordered.filter((row) =>
        row.patient.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
      )
    : ordered;
  const visible = dateKey ? filtered : filtered.slice(0, MAX_ROWS);
  const hasFilters = Boolean(dateKey) || Boolean(status) || Boolean(normalizedQuery);

  const clearFilters = (): void => {
    setDateKey("");
    setStatus("");
    setQuery("");
  };

  const columns: readonly DataTableColumn<DoctorAppointmentDto>[] = [
    {
      key: "patient",
      header: "Paciente",
      render: (row) => (
        <span className="text-sm font-medium text-texto">
          {row.patient.name}
        </span>
      ),
      hint: (row) => row.patient.specialty ?? "Paciente",
    },
    {
      key: "scheduledAt",
      header: "Horário",
      render: (row) => (
        <span className="font-data text-sm">
          {formatDateTimeWithContext(row.scheduledAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <AppointmentStatusBadge status={row.status} />,
    },
    {
      key: "preConsult",
      header: "Pré-consulta",
      render: (row) =>
        row.hasPreConsult ? (
          <Badge variant="success">Respondida</Badge>
        ) : (
          <Badge variant="neutral">Sem respostas</Badge>
        ),
    },
    {
      key: "consultationId",
      header: "Sala",
      render: (row) =>
        row.consultationId ? (
          <span className="flex flex-col gap-1">
            <Badge variant="brand" live>
              Aberta
            </Badge>
            <span
              className="max-w-40 truncate font-data text-xs text-texto-3"
              title={row.consultationId}
            >
              {row.consultationId}
            </span>
          </span>
        ) : (
          <span className="text-sm text-texto-3">—</span>
        ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => (
        <span
          className="flex flex-wrap items-center gap-2"
          data-testid="appointment-actions"
          data-appointment-id={row.appointmentId}
          data-appointment-status={row.status}
          data-consultation-id={row.consultationId ?? ""}
        >
          <Link
            href={`/medico/pacientes/${row.patient.id}?appointmentId=${row.appointmentId}`}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <Eye aria-hidden="true" />
            Ver paciente
          </Link>
          <StartConsultationAction appointment={row} size="sm" />
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="doctor-agenda">
      <PageHeader
        title="Atendimentos"
        description="Filtre por data e status, revise a pré-consulta e inicie o teleatendimento."
      />

      <div
        role="search"
        aria-label="Filtros da agenda"
        className="grid gap-4 rounded-lg border border-borda bg-bg-elev p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <Input
          label="Buscar paciente"
          type="search"
          placeholder="Nome do paciente"
          value={query}
          data-testid="agenda-search"
          onChange={(event) => setQuery(event.target.value)}
          leading={<Search aria-hidden="true" className="size-4" />}
        />
        <Input
          label="Data"
          type="date"
          value={dateKey}
          max="2100-12-31"
          onChange={(event) => setDateKey(event.target.value)}
        />
        <Select
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(event) =>
            setStatus(event.target.value as AppointmentStatus | "")
          }
        />
        <div className="flex items-end gap-2 pb-0.5">
          <Button
            variant="secondary"
            onClick={() => setDateKey(todaySaoPauloKey())}
          >
            <CalendarDays aria-hidden="true" />
            Hoje
          </Button>
          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasFilters}
            data-testid="clear-agenda-filters"
          >
            <FilterX aria-hidden="true" />
            Ver todas
          </Button>
        </div>
      </div>

      <p className="text-xs text-texto-3" aria-live="polite">
        {dateKey ? `${formatDateKeyLabel(dateKey)} · ` : "Todas as datas · "}
        {filtered.length}{" "}
        {filtered.length === 1 ? "atendimento" : "atendimentos"}
        {normalizedQuery ? ` para “${query.trim()}”` : ""}
        {!dateKey && filtered.length > MAX_ROWS
          ? ` · exibindo os primeiros ${MAX_ROWS}`
          : ""}
      </p>

      {state.loading ? (
        <ListSkeleton items={4} />
      ) : state.error ? (
        <ErrorState
          title="Não foi possível carregar os atendimentos"
          description="A agenda não pôde ser carregada. Verifique sua conexão e tente novamente."
          onRetry={state.reload}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum atendimento encontrado"
          description={
            hasFilters
              ? "Nenhum atendimento corresponde aos filtros escolhidos. Ajuste a data ou o status para ver outros resultados."
              : "Sua agenda ainda não tem atendimentos registrados."
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          getRowKey={(row) => row.appointmentId}
          caption="Agenda de atendimentos do médico"
        />
      )}
    </div>
  );
}
