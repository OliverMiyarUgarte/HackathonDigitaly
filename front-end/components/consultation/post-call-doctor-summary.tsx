"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConsultationSummary } from "@/lib/realtime/use-consultation-summary";
import { ConsultationSummaryCard } from "./consultation-summary";

export interface PostCallDoctorSummaryProps {
  consultationId: string;
  counterpartLabel?: string | null;
}

export function PostCallDoctorSummary({
  consultationId,
  counterpartLabel,
}: PostCallDoctorSummaryProps) {
  const { summary, status, refresh } = useConsultationSummary(
    consultationId,
    true,
  );

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="post-call-doctor"
      data-consultation-id={consultationId}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-5 text-sucesso" />
            <CardTitle level="h1" className="text-3xl">
              Atendimento encerrado
            </CardTitle>
          </div>
          <CardDescription>
            {counterpartLabel
              ? `A teleconsulta com ${counterpartLabel} foi finalizada.`
              : "A teleconsulta foi finalizada."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/medico/consultas/${consultationId}/fechamento`}
            className={buttonClasses({ variant: "primary" })}
          >
            Registrar prontuário
            <ArrowRight aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      <ConsultationSummaryCard
        status={status}
        summary={summary}
        role="doctor"
        onRetry={refresh}
      />
    </div>
  );
}
