"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/paciente/section-states";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, get, post } from "@/lib/api";
import {
  appointmentSchema,
  consultationSchema,
  medicalRecordSchema,
  patientOverviewSchema,
  preConsultAnswerListSchema,
  type AppointmentDto,
  type ConsultationDto,
  type MedicalRecordDto,
  type PatientOverviewDto,
  type PreConsultAnswerDto,
} from "@/lib/contracts";
import { formatDateTimeWithContext, formatDuration } from "@/lib/format";
import { useAsyncWithKey, useToast } from "@/lib/hooks";
import { consultationDurationSeconds } from "@/lib/medico";
import { useConsultationSummary } from "@/lib/realtime/use-consultation-summary";
import { ConsultationSummaryCard } from "@/components/consultation/consultation-summary";
import { PreConsultList } from "./pre-consult-list";

interface ClosingContext {
  consultation: ConsultationDto;
  appointment: AppointmentDto;
  overview: PatientOverviewDto;
  preConsult: PreConsultAnswerDto[];
}

interface PrescriptionRow {
  id: string;
  value: string;
}

const MAX_NOTES = 5000;
const MAX_DIAGNOSIS = 2000;
const MAX_PRESCRIPTION = 200;

const closingFormSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(1, "Descreva a evolução do atendimento.")
    .max(MAX_NOTES, `Use no máximo ${MAX_NOTES} caracteres.`),
  diagnosis: z
    .string()
    .trim()
    .max(MAX_DIAGNOSIS, `Use no máximo ${MAX_DIAGNOSIS} caracteres.`),
});

export interface ConsultationClosingProps {
  consultationId: string;
}

export function ConsultationClosing({
  consultationId,
}: ConsultationClosingProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [rows, setRows] = useState<PrescriptionRow[]>([
    { id: "prescription-0", value: "" },
  ]);
  const nextRowIdRef = useRef(1);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<MedicalRecordDto | null>(null);
  const summaryState = useConsultationSummary(consultationId, true);

  const contextState = useAsyncWithKey(async (): Promise<ClosingContext> => {
    const consultation = await get(
      `/consultations/${consultationId}`,
      consultationSchema,
    );
    const appointment = await get(
      `/appointments/${consultation.appointmentId}`,
      appointmentSchema,
    );
    const [overview, preConsult] = await Promise.all([
      get(`/patients/${appointment.patientId}/overview`, patientOverviewSchema),
      get(
        `/appointments/${consultation.appointmentId}/pre-consult`,
        preConsultAnswerListSchema,
      ),
    ]);
    return { consultation, appointment, overview, preConsult };
  }, consultationId);

  if (contextState.loading) {
    return <ListSkeleton items={3} />;
  }

  if (contextState.error || !contextState.data) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Fechamento do atendimento</h1>
        <ErrorState
          title="Não foi possível carregar o atendimento"
          description="O contexto desta consulta não pôde ser carregado. Tente novamente."
          onRetry={contextState.reload}
        />
      </div>
    );
  }

  const context = contextState.data;
  const patientId = context.overview.patient.id;
  const existingRecord =
    context.overview.history.find(
      (record) => record.consultationId === consultationId,
    ) ?? null;
  const duration = consultationDurationSeconds(context.consultation);

  if (created) {
    return (
      <div className="flex flex-col gap-6" data-testid="closing-success">
        <h1 className="text-texto">Fechamento do atendimento</h1>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2
                aria-hidden="true"
                className="size-5 text-sucesso"
              />
              <CardTitle>Prontuário registrado</CardTitle>
            </div>
            <CardDescription>
              O atendimento de {context.overview.patient.name} foi documentado
              com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="max-w-[68ch] text-sm text-texto-2">
              O registro fica disponível no prontuário do paciente e no
              histórico da sua agenda.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/medico/prontuario/${created.id}`}
                className={buttonClasses({ variant: "primary" })}
              >
                <FileText aria-hidden="true" />
                Abrir registro
              </Link>
              <Link
                href={`/medico/pacientes/${patientId}`}
                className={buttonClasses({ variant: "secondary" })}
              >
                <UserRound aria-hidden="true" />
                Ver paciente
              </Link>
              <Link
                href="/medico/atendimentos"
                className={buttonClasses({ variant: "ghost" })}
              >
                <CalendarCheck aria-hidden="true" />
                Voltar à agenda
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingRecord) {
    return (
      <div className="flex flex-col gap-6" data-testid="closing-record-exists">
        <h1 className="text-texto">Fechamento do atendimento</h1>
        <Alert variant="info" title="Prontuário já registrado">
          <div className="flex flex-col items-start gap-3">
            <span>
              Este atendimento já possui um registro médico. Ele não pode ser
              reenviado por aqui.
            </span>
            <Link
              href={`/medico/prontuario/${existingRecord.id}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Abrir prontuário existente
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  const addRow = (): void => {
    const id = `prescription-${nextRowIdRef.current}`;
    nextRowIdRef.current += 1;
    setRows((current) => [...current, { id, value: "" }]);
  };

  const removeRow = (id: string): void => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, value: string): void => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, value } : row)),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotesError(null);
    setDiagnosisError(null);
    setPrescriptionError(null);

    const parsed = closingFormSchema.safeParse({ notes, diagnosis });
    let invalid = !parsed.success;
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "notes") {
          setNotesError(issue.message);
        }
        if (issue.path[0] === "diagnosis") {
          setDiagnosisError(issue.message);
        }
      }
    }

    const prescriptions = rows
      .map((row) => row.value.trim())
      .filter((value) => value.length > 0);
    if (prescriptions.some((value) => value.length > MAX_PRESCRIPTION)) {
      setPrescriptionError(
        `Cada prescrição deve ter no máximo ${MAX_PRESCRIPTION} caracteres.`,
      );
      invalid = true;
    }

    if (invalid || !parsed.success) {
      return;
    }

    const trimmedDiagnosis = parsed.data.diagnosis;

    setSubmitting(true);
    try {
      const record = await post(
        "/records",
        {
          consultationId,
          patientId,
          notes: parsed.data.notes,
          ...(trimmedDiagnosis.length > 0
            ? { diagnosis: trimmedDiagnosis }
            : {}),
          prescriptions,
        },
        medicalRecordSchema,
      );
      setCreated(record);
      toast({
        variant: "success",
        title: "Prontuário registrado",
        description: "O registro foi salvo no histórico do paciente.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "RECORD_EXISTS") {
        toast({
          variant: "info",
          title: "Prontuário já existe",
          description: "Abrindo o registro existente deste atendimento.",
        });
        contextState.reload();
      } else if (error instanceof ApiError) {
        toast({
          variant: "error",
          title: "Não foi possível salvar o prontuário",
          description: error.message,
        });
      } else {
        toast({
          variant: "error",
          title: "Não foi possível salvar o prontuário",
          description: "Verifique sua conexão e tente novamente.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (context.consultation.status === "active") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Fechamento do atendimento</h1>
        <Alert variant="warning" title="Atendimento ainda em andamento">
          <div className="flex flex-col items-start gap-3">
            <span>
              Encerre o teleatendimento antes de registrar o prontuário.
            </span>
            <Link
              href={`/medico/consultas/${consultationId}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Voltar à sala
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="consultation-closing">
      <PageHeader
        title="Fechamento do atendimento"
        description="Registre as notas, o diagnóstico e as prescrições da consulta."
      />

      <ConsultationSummaryCard
        status={summaryState.status}
        summary={summaryState.summary}
        role="doctor"
        onRetry={summaryState.refresh}
        onUseAsRecordBase={() =>
          setNotes(summaryState.summary?.doctorSummary ?? "")
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contexto da consulta</CardTitle>
          <CardDescription>
            Confira o paciente e a duração antes de salvar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2 text-sm text-texto">
            <UserRound aria-hidden="true" className="size-4 text-accent" />
            {context.overview.patient.name}
          </span>
          <span className="inline-flex items-center gap-2 font-data text-sm text-texto-2">
            <Clock aria-hidden="true" className="size-4 text-texto-3" />
            {duration === null
              ? "Duração indisponível"
              : formatDuration(duration)}
          </span>
          <span className="font-data text-xs text-texto-3">
            Encerrado em{" "}
            {context.consultation.endedAt
              ? formatDateTimeWithContext(context.consultation.endedAt)
              : formatDateTimeWithContext(new Date())}
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registro clínico</CardTitle>
            <CardDescription>
              As notas são obrigatórias. Diagnóstico e prescrições são
              opcionais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => void handleSubmit(event)}
              noValidate
              className="flex flex-col gap-5"
            >
              <Textarea
                label="Notas do atendimento"
                value={notes}
                error={notesError ?? undefined}
                hint="Descreva queixas, achados e conduta. Campo obrigatório."
                required
                maxLength={MAX_NOTES}
                data-testid="closing-notes"
                onChange={(event) => setNotes(event.target.value)}
              />

              <Input
                label="Diagnóstico"
                value={diagnosis}
                error={diagnosisError ?? undefined}
                hint="Opcional. Informe o diagnóstico principal ou suspeita."
                maxLength={MAX_DIAGNOSIS}
                data-testid="closing-diagnosis"
                onChange={(event) => setDiagnosis(event.target.value)}
              />

              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium text-texto-2">
                  Prescrições
                </legend>
                {rows.map((row, index) => (
                  <div key={row.id} className="flex items-end gap-2">
                    <Input
                      label={index === 0 ? "Medicamento e posologia" : undefined}
                      value={row.value}
                      maxLength={MAX_PRESCRIPTION}
                      placeholder="Ex.: Losartana 50 mg, 1 comprimido pela manhã"
                      containerClassName="flex-1"
                      data-testid={`prescription-input-${index}`}
                      onChange={(event) =>
                        updateRow(row.id, event.target.value)
                      }
                    />
                    <Button
                      variant="ghost"
                      aria-label={`Remover prescrição ${index + 1}`}
                      disabled={rows.length === 1}
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {prescriptionError ? (
                  <p className="text-xs text-erro">{prescriptionError}</p>
                ) : null}
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addRow}
                    data-testid="add-prescription"
                  >
                    <Plus aria-hidden="true" />
                    Adicionar prescrição
                  </Button>
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  data-testid="submit-record"
                >
                  {submitting ? "Salvando..." : "Salvar prontuário"}
                  {submitting ? null : <ArrowRight aria-hidden="true" />}
                </Button>
                <Link
                  href={`/medico/pacientes/${patientId}`}
                  className={buttonClasses({ variant: "ghost" })}
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pré-consulta</CardTitle>
            <CardDescription>
              Respostas enviadas pelo paciente, somente leitura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreConsultList answers={context.preConsult} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
