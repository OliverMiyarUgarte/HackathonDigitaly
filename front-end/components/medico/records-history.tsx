"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ExternalLink } from "lucide-react";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/paciente/section-states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError, get } from "@/lib/api";
import {
  appointmentSchema,
  consultationHistoryListSchema,
  patientOverviewSchema,
  userDtoSchema,
  type ConsultationHistoryItemDto,
} from "@/lib/contracts";
import {
  formatDate,
  formatDateTimeWithContext,
  formatDuration,
  formatTime,
} from "@/lib/format";
import { useAsyncWithKey, useToast } from "@/lib/hooks";

export interface RecordsHistoryProps {
  patientId?: string | null;
}

const MAX_ROWS = 50;

function durationSeconds(startedAt: string, endedAt: string | null): number | null {
  if (!endedAt) {
    return null;
  }
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }
  return Math.floor((end - start) / 1000);
}

export function RecordsHistory({ patientId = null }: RecordsHistoryProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const state = useAsyncWithKey(
    () => {
      const query = patientId
        ? `?patientId=${encodeURIComponent(patientId)}`
        : "";
      return get(`/records/history${query}`, consultationHistoryListSchema);
    },
    patientId ?? "all",
  );

  const items = state.data ?? [];
  const visible = items.slice(0, MAX_ROWS);

  const patientState = useAsyncWithKey(
    () =>
      patientId
        ? get(`/users/patients/${patientId}`, userDtoSchema)
        : Promise.resolve(null),
    patientId ?? "",
  );
  const patientName = patientState.data?.name ?? null;

  const openRecord = async (
    item: ConsultationHistoryItemDto,
  ): Promise<void> => {
    setOpeningId(item.consultationId);
    try {
      const appointment = await get(
        `/appointments/${item.appointmentId}`,
        appointmentSchema,
      );
      const overview = await get(
        `/patients/${appointment.patientId}/overview`,
        patientOverviewSchema,
      );
      const record = overview.history.find(
        (entry) => entry.consultationId === item.consultationId,
      );
      if (record) {
        router.push(`/medico/prontuario/${record.id}`);
        return;
      }
      toast({
        variant: "warning",
        title: "Nenhum prontuário registrado",
        description:
          "Este atendimento foi encerrado sem registro médico associado.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast({
          variant: "error",
          title: "Acesso restrito",
          description: "Você não tem vínculo com o paciente deste atendimento.",
        });
      } else {
        toast({
          variant: "error",
          title: "Não foi possível abrir o prontuário",
          description: "Tente novamente em instantes.",
        });
      }
    } finally {
      setOpeningId(null);
    }
  };

  const columns: readonly DataTableColumn<ConsultationHistoryItemDto>[] = [
    {
      key: "startedAt",
      header: "Atendimento",
      render: (row) => (
        <span className="font-data text-sm">
          {formatDate(row.startedAt)} às {formatTime(row.startedAt)}
        </span>
      ),
      hint: (row) => formatDateTimeWithContext(row.startedAt),
    },
    {
      key: "duration",
      header: "Duração",
      render: (row) => {
        const seconds = durationSeconds(row.startedAt, row.endedAt);
        return (
          <span className="font-data text-sm">
            {seconds === null ? "Em andamento" : formatDuration(seconds)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.endedAt ? (
          <Badge variant="neutral">Encerrado</Badge>
        ) : (
          <Badge variant="success" live>
            Em andamento
          </Badge>
        ),
    },
    {
      key: "diagnosis",
      header: "Diagnóstico",
      render: (row) => (
        <span className="text-sm text-texto-2">
          {row.diagnosis ?? "Sem diagnóstico registrado"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          disabled={openingId === row.consultationId}
          data-testid={`open-record-${row.consultationId}`}
          onClick={() => void openRecord(row)}
        >
          <ExternalLink aria-hidden="true" />
          {openingId === row.consultationId
            ? "Abrindo..."
            : "Abrir prontuário"}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="records-history">
      <PageHeader
        title="Prontuário"
        description="Reveja os atendimentos que você conduziu e reabra os registros clínicos."
        action={
          <Link
            href="/medico/atendimentos"
            className={buttonClasses({ variant: "secondary" })}
          >
            Ir para a agenda
          </Link>
        }
      />

      {patientId ? (
        <p className="text-xs text-texto-3">
          {patientName
            ? `Mostrando apenas os atendimentos de ${patientName}.`
            : "Mostrando apenas os atendimentos do paciente selecionado."}
        </p>
      ) : null}

      {state.loading ? (
        <ListSkeleton items={4} />
      ) : state.error ? (
        <ErrorState
          title="Não foi possível carregar o histórico"
          description="Os atendimentos registrados não puderam ser carregados. Tente novamente."
          onRetry={state.reload}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum atendimento no histórico"
          description="Quando você concluir um teleatendimento, ele aparece aqui para consulta e reabertura do prontuário."
        />
      ) : (
        <>
          <p className="text-xs text-texto-3" aria-live="polite">
            {items.length}{" "}
            {items.length === 1 ? "atendimento" : "atendimentos"}
            {items.length > MAX_ROWS
              ? ` · exibindo os primeiros ${MAX_ROWS}`
              : ""}
          </p>
          <DataTable
            columns={columns}
            rows={visible}
            getRowKey={(row) => row.consultationId}
            caption="Histórico de atendimentos do médico"
          />
        </>
      )}
    </div>
  );
}
