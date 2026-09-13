"use client";

import {
  ChevronDown,
  ClipboardList,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeWithContext } from "@/lib/format";
import type { ConsultationSummaryDto, UserRole } from "@/lib/contracts";
import type { ConsultationSummaryStatus } from "@/lib/realtime/use-consultation-summary";

export interface ConsultationSummaryCardProps {
  status: ConsultationSummaryStatus;
  summary: ConsultationSummaryDto | null;
  role: UserRole;
  onRetry: () => void;
  onUseAsRecordBase?: () => void;
  className?: string;
  testId?: string;
}

const TITLE = "Resumo do atendimento";

function SummaryPending({
  onRetry,
  className,
  testId,
}: {
  onRetry: () => void;
  className?: string;
  testId: string;
}) {
  return (
    <Card className={className} data-testid={testId} data-status="pending">
      <CardHeader>
        <CardTitle className="text-lg">{TITLE}</CardTitle>
        <CardDescription>
          O resumo é gerado pela inteligência artificial ao final da consulta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert
          variant="info"
          title="Resumo em preparação"
          data-testid="summary-pending"
        >
          <div className="flex flex-col items-start gap-3">
            <span>
              Assim que o resumo ficar pronto, ele aparece aqui automaticamente.
            </span>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Verificar novamente
            </Button>
          </div>
        </Alert>
      </CardContent>
    </Card>
  );
}

function SummaryError({
  onRetry,
  className,
  testId,
}: {
  onRetry: () => void;
  className?: string;
  testId: string;
}) {
  return (
    <Card className={className} data-testid={testId} data-status="error">
      <CardHeader>
        <CardTitle className="text-lg">{TITLE}</CardTitle>
        <CardDescription>
          O resumo é gerado pela inteligência artificial ao final da consulta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert
          variant="error"
          title="Não foi possível carregar o resumo"
          data-testid="summary-error"
        >
          <div className="flex flex-col items-start gap-3">
            <span>
              O resumo não pôde ser carregado. Verifique a conexão e tente
              novamente.
            </span>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        </Alert>
      </CardContent>
    </Card>
  );
}

function SummaryLoading({
  className,
  testId,
}: {
  className?: string;
  testId: string;
}) {
  return (
    <Card className={className} data-testid={testId} data-status="loading">
      <CardHeader>
        <CardTitle className="text-lg">{TITLE}</CardTitle>
        <CardDescription>
          Carregando o resumo gerado ao final da consulta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardContent>
    </Card>
  );
}

export function ConsultationSummaryCard({
  status,
  summary,
  role,
  onRetry,
  onUseAsRecordBase,
  className,
  testId = "consultation-summary",
}: ConsultationSummaryCardProps) {
  if (status === "loading") {
    return <SummaryLoading className={className} testId={testId} />;
  }

  if (status === "pending" || (status === "ready" && !summary)) {
    return <SummaryPending onRetry={onRetry} className={className} testId={testId} />;
  }

  if (status === "error" || !summary) {
    return <SummaryError onRetry={onRetry} className={className} testId={testId} />;
  }

  return (
    <Card className={className} data-testid={testId} data-status="ready">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-5 text-accent" />
            <CardTitle className="text-lg">{TITLE}</CardTitle>
          </div>
          <Badge variant="brand">Gerado por IA</Badge>
        </div>
        <CardDescription>
          Gerado automaticamente a partir da conversa ao final do atendimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {role === "patient" ? (
          <>
            <section className="flex flex-col gap-2" data-testid="summary-patient">
              <h3 className="inline-flex items-center gap-2 text-sm font-medium text-texto-2">
                <ShieldCheck aria-hidden="true" className="size-4 text-accent" />
                Em linguagem simples
              </h3>
              <p className="max-w-[68ch] whitespace-pre-line text-base text-texto">
                {summary.patientSummary}
              </p>
            </section>
            <details
              className="group flex flex-col gap-2 rounded-md border border-borda bg-bg-elev-2 p-4"
              data-testid="summary-clinical"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-texto-2">
                Resumo clínico
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </summary>
              <p
                className="mt-3 max-w-[68ch] whitespace-pre-line text-sm text-texto-2"
                data-testid="summary-doctor"
              >
                {summary.doctorSummary}
              </p>
            </details>
          </>
        ) : (
          <>
            <section className="flex flex-col gap-2" data-testid="summary-doctor">
              <h3 className="inline-flex items-center gap-2 text-sm font-medium text-texto-2">
                <ClipboardList aria-hidden="true" className="size-4 text-accent" />
                Resumo clínico
              </h3>
              <p className="max-w-[68ch] whitespace-pre-line text-base text-texto">
                {summary.doctorSummary}
              </p>
            </section>
            <section className="flex flex-col gap-2" data-testid="summary-patient">
              <h3 className="inline-flex items-center gap-2 text-sm font-medium text-texto-2">
                <ShieldCheck aria-hidden="true" className="size-4 text-accent" />
                Orientação ao paciente
              </h3>
              <p className="max-w-[68ch] whitespace-pre-line text-sm text-texto-2">
                {summary.patientSummary}
              </p>
            </section>
          </>
        )}

        <p className="font-data text-xs text-texto-3">
          Gerado em {formatDateTimeWithContext(summary.generatedAt)}
        </p>

        {onUseAsRecordBase ? (
          <div>
            <Button
              variant="secondary"
              onClick={onUseAsRecordBase}
              data-testid="use-summary-notes"
            >
              <FileText aria-hidden="true" />
              Usar como base do prontuário
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
