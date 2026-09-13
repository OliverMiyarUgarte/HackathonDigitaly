"use client";

import Link from "next/link";
import { z } from "zod";
import {
  CalendarCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  Stethoscope,
} from "lucide-react";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/paciente/section-states";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { get } from "@/lib/api";
import { consultationHistoryItemSchema } from "@/lib/contracts";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

const historyListSchema = z.array(consultationHistoryItemSchema);

function durationInSeconds(startedAt: string, endedAt: string | null): number | null {
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

export function ConsultationHistory() {
  const state = useAsync(() => get("/consultations/mine", historyListSchema));
  const consultations = state.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Histórico de consultas"
        description="Reveja os atendimentos realizados, a duração e o diagnóstico registrado pelo médico."
      />

      {state.loading ? (
        <ListSkeleton items={3} />
      ) : state.error ? (
        <ErrorState
          title="Não foi possível carregar o histórico"
          description="As consultas realizadas não puderam ser carregadas. Tente novamente."
          onRetry={state.reload}
        />
      ) : consultations.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma consulta realizada"
          description="Quando um atendimento for concluído, ele aparece aqui com data, duração e orientações."
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
        <ul className="flex flex-col gap-3">
          {consultations.map((item) => {
            const seconds = durationInSeconds(item.startedAt, item.endedAt);
            return (
              <li key={item.consultationId}>
                <article className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-borda bg-bg-elev p-5">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-texto">
                        <Stethoscope
                          aria-hidden="true"
                          className="size-4 text-accent"
                        />
                        {item.doctor.name}
                      </span>
                      {item.endedAt ? (
                        <Badge variant="neutral">Concluída</Badge>
                      ) : (
                        <Badge variant="success" live>
                          Em andamento
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-texto-2">
                      {item.doctor.specialty ?? "Especialidade não informada"}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 font-data text-xs text-texto-3">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarCheck aria-hidden="true" className="size-3.5" />
                        {formatDate(item.startedAt)} às {formatTime(item.startedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock aria-hidden="true" className="size-3.5" />
                        {seconds === null
                          ? "Em andamento"
                          : formatDuration(seconds)}
                      </span>
                    </div>
                    {item.diagnosis ? (
                      <p className="max-w-[68ch] text-sm text-texto-2">
                        <span className="font-medium text-texto">
                          Diagnóstico:{" "}
                        </span>
                        {item.diagnosis}
                      </p>
                    ) : (
                      <p className="text-sm text-texto-3">
                        Sem diagnóstico registrado.
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/paciente/consultas/${item.consultationId}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    {item.endedAt ? "Ver resumo" : "Acompanhar"}
                    <ExternalLink aria-hidden="true" />
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
