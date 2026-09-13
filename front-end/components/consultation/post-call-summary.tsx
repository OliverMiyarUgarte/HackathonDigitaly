"use client";

import Link from "next/link";
import { CalendarCheck, CheckCircle2, FileText, Home } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTimeWithContext } from "@/lib/format";

export interface PostCallSummaryProps {
  consultationId: string;
  endedAt?: string | null;
  counterpartLabel?: string | null;
}

export function PostCallSummary({
  consultationId,
  endedAt,
  counterpartLabel,
}: PostCallSummaryProps) {
  return (
    <Card data-testid="post-call-summary" data-consultation-id={consultationId}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="size-5 text-sucesso" />
          <CardTitle>Atendimento encerrado</CardTitle>
        </div>
        <CardDescription>
          {counterpartLabel
            ? `A teleconsulta com ${counterpartLabel} foi finalizada.`
            : "A teleconsulta foi finalizada."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {endedAt ? (
          <p className="font-data text-sm text-texto-2">
            Encerrado em {formatDateTimeWithContext(endedAt)}
          </p>
        ) : null}
        <p className="max-w-[68ch] text-sm text-texto-2">
          O resumo do atendimento e as orientações ficam disponíveis no seu
          histórico e no prontuário.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/paciente/historico"
            className={buttonClasses({ variant: "primary" })}
          >
            <FileText aria-hidden="true" />
            Ver histórico
          </Link>
          <Link
            href="/paciente/prontuario"
            className={buttonClasses({ variant: "secondary" })}
          >
            <CalendarCheck aria-hidden="true" />
            Abrir prontuário
          </Link>
          <Link
            href="/paciente"
            className={buttonClasses({ variant: "ghost" })}
          >
            <Home aria-hidden="true" />
            Voltar ao início
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
