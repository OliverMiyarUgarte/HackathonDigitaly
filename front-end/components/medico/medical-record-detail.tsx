"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Pill, Stethoscope } from "lucide-react";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/paciente/section-states";
import { Alert } from "@/components/ui/alert";
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
import { medicalRecordSchema, userDtoSchema } from "@/lib/contracts";
import { formatDateTimeWithContext } from "@/lib/format";
import { useAsyncWithKey } from "@/lib/hooks";

export interface MedicalRecordDetailProps {
  recordId: string;
}

export function MedicalRecordDetail({ recordId }: MedicalRecordDetailProps) {
  const recordState = useAsyncWithKey(
    () => get(`/records/${recordId}`, medicalRecordSchema),
    recordId,
  );

  const patientState = useAsyncWithKey(
    () =>
      recordState.data
        ? get(`/users/patients/${recordState.data.patientId}`, userDtoSchema)
        : Promise.resolve(null),
    recordState.data?.patientId ?? "",
  );

  if (recordState.loading) {
    return <ListSkeleton items={2} />;
  }

  if (recordState.error instanceof ApiError && recordState.error.status === 403) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Registro médico</h1>
        <Alert variant="warning" title="Sem vínculo com este paciente">
          Você não possui atendimentos com o paciente deste prontuário. O
          acesso é permitido apenas a profissionais com vínculo de atendimento.
        </Alert>
      </div>
    );
  }

  if (recordState.error || !recordState.data) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Registro médico</h1>
        <ErrorState
          title="Prontuário não encontrado"
          description="Não foi possível carregar este registro médico. Volte ao histórico e tente novamente."
          onRetry={recordState.reload}
        />
      </div>
    );
  }

  const record = recordState.data;
  const patientName = patientState.data?.name ?? "Paciente";

  return (
    <div className="flex flex-col gap-6" data-testid="medical-record-detail">
      <PageHeader
        title="Registro médico"
        description={`Documentado em ${formatDateTimeWithContext(record.createdAt)}`}
        action={
          <Link
            href={`/medico/pacientes/${record.patientId}`}
            className={buttonClasses({ variant: "secondary" })}
          >
            <ArrowLeft aria-hidden="true" />
            Ver paciente
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {patientName}
          </CardTitle>
          <CardDescription>
            Resumo clínico registrado ao final do teleatendimento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-texto-3">
              <Stethoscope aria-hidden="true" className="size-3.5" />
              Diagnóstico
            </span>
            <span className="text-sm text-texto">
              {record.diagnosis ?? "Sem diagnóstico registrado"}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-texto-3">
              <FileText aria-hidden="true" className="size-3.5" />
              Notas do atendimento
            </span>
            <p className="max-w-[68ch] whitespace-pre-wrap text-sm text-texto">
              {record.notes}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-texto-3">
              <Pill aria-hidden="true" className="size-3.5" />
              Prescrições
            </span>
            {record.prescriptions.length === 0 ? (
              <p className="text-sm text-texto-2">
                Nenhuma prescrição registrada.
              </p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-texto">
                {record.prescriptions.map((prescription, index) => (
                  <li key={`${record.id}-prescription-${index}`}>
                    {prescription}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {patientState.error ? (
        <EmptyState
          icon={FileText}
          title="Paciente indisponível"
          description="Este registro segue acessível, mas os dados do paciente não puderam ser carregados agora."
        />
      ) : null}
    </div>
  );
}
