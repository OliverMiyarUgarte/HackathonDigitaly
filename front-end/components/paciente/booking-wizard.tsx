"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Search,
  Stethoscope,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, get, post } from "@/lib/api";
import {
  appointmentSchema,
  createAppointmentRequestSchema,
  doctorSummaryDtoSchema,
  slotSchema,
  type DoctorSummaryDto,
  type SlotDto,
} from "@/lib/contracts";
import { formatCrm, formatDateTimeWithContext, formatTime } from "@/lib/format";
import { groupSlotsByDay, PRE_CONSULT_QUESTIONS } from "@/lib/appointments";
import { useAsync, useAsyncWithKey, useToast } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { ErrorState } from "./section-states";

const doctorListSchema = z.array(doctorSummaryDtoSchema);
const slotListSchema = z.array(slotSchema);

const STEPS = [
  { id: "medico", label: "Médico" },
  { id: "horario", label: "Horário" },
  { id: "pre-consulta", label: "Pré-consulta" },
  { id: "resumo", label: "Resumo" },
] as const;

const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  SLOT_TAKEN:
    "Esse horário acabou de ser reservado por outra pessoa. Escolha um novo horário.",
  NOT_FOUND:
    "Este médico não está mais disponível para agendamento. Selecione outro profissional.",
  VALIDATION_FAILED:
    "Alguns dados do agendamento precisam de correção. Revise o horário e tente novamente.",
  APPOINTMENT_NOT_CONFIRMED:
    "O agendamento não está mais disponível. Crie um novo agendamento.",
  RATE_LIMITED:
    "Muitas solicitações em pouco tempo. Aguarde um minuto e tente novamente.",
};

function uniqueSpecialties(doctors: DoctorSummaryDto[]): string[] {
  const set = new Set<string>();
  for (const doctor of doctors) {
    if (doctor.specialty) {
      set.add(doctor.specialty);
    }
  }
  return [...set].sort((left, right) => left.localeCompare(right));
}

export function BookingWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [specialty, setSpecialty] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorSummaryDto | null>(
    null,
  );
  const [selectedSlot, setSelectedSlot] = useState<SlotDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const specialtiesState = useAsync(() =>
    get("/users/doctors", doctorListSchema),
  );

  const doctorsState = useAsyncWithKey(() => {
    const params = new URLSearchParams();
    if (specialty) {
      params.set("specialty", specialty);
    }
    if (search) {
      params.set("q", search);
    }
    const query = params.toString();
    return get(`/users/doctors${query ? `?${query}` : ""}`, doctorListSchema);
  }, `${specialty}|${search}`);

  const specialtyOptions = useMemo(
    () =>
      uniqueSpecialties(specialtiesState.data ?? []).map((value) => ({
        value,
        label: value,
      })),
    [specialtiesState.data],
  );

  const slotsState = useAsyncWithKey(async () => {
    if (!selectedDoctor) {
      return [];
    }
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    return get(
      `/appointments/doctors/${selectedDoctor.id}/slots?from=${encodeURIComponent(
        from,
      )}&to=${encodeURIComponent(to)}`,
      slotListSchema,
    );
  }, selectedDoctor?.id ?? "");

  const groupedSlots = useMemo(
    () => groupSlotsByDay(slotsState.data ?? []),
    [slotsState.data],
  );

  const answeredCount = PRE_CONSULT_QUESTIONS.filter(
    (question) => (answers[question.key] ?? "").trim().length > 0,
  ).length;

  const handleSelectDoctor = (doctor: DoctorSummaryDto): void => {
    setSelectedDoctor(doctor);
    setSelectedSlot(null);
  };

  const handleContinue = (): void => {
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const handleBack = (): void => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!selectedDoctor || !selectedSlot) {
      return;
    }
    const preConsult = PRE_CONSULT_QUESTIONS.map((question) => ({
      questionKey: question.key,
      answer: (answers[question.key] ?? "").trim(),
    })).filter((answer) => answer.answer.length > 0);

    const parsed = createAppointmentRequestSchema.safeParse({
      doctorId: selectedDoctor.id,
      scheduledAt: selectedSlot.startsAt,
      preConsult: preConsult.length > 0 ? preConsult : undefined,
    });
    if (!parsed.success) {
      setSubmitError(
        "Os dados do agendamento estão incompletos. Revise as etapas e tente novamente.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const appointment = await post(
        "/appointments",
        parsed.data,
        appointmentSchema,
      );
      toast({
        variant: "success",
        title: "Agendamento criado",
        description: "Confirme com o código enviado para o seu e-mail.",
      });
      router.push(
        `/paciente/confirmar-agendamento?appointmentId=${appointment.id}`,
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(
          BOOKING_ERROR_MESSAGES[error.code] ??
            "Não foi possível concluir o agendamento. Tente novamente.",
        );
        if (error.code === "SLOT_TAKEN") {
          setSelectedSlot(null);
          setStep(1);
          slotsState.reload();
        }
      } else {
        setSubmitError(
          "Não foi possível concluir o agendamento. Verifique sua conexão e tente novamente.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium text-texto">Agendar consulta</h2>
        <p className="max-w-[68ch] text-texto-2">
          Escolha o médico, selecione um horário disponível, responda a
          pré-consulta se quiser e confirme o agendamento.
        </p>
      </div>

      <Stepper steps={STEPS} current={step} />

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escolha o médico</CardTitle>
            <CardDescription>
              Filtre por especialidade ou busque pelo nome. A API lista apenas
              profissionais ativos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Input
                label="Buscar por nome"
                placeholder="Nome do médico"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                leading={<Search aria-hidden="true" className="size-4" />}
              />
              <Select
                label="Especialidade"
                placeholder="Todas"
                value={specialty}
                options={specialtyOptions}
                onChange={(event) => {
                  setSpecialty(event.target.value);
                  setSelectedSlot(null);
                }}
              />
            </div>

            {doctorsState.loading ? (
              <p className="text-sm text-texto-3" role="status">
                Carregando médicos...
              </p>
            ) : doctorsState.error ? (
              <ErrorState
                title="Não foi possível carregar os médicos"
                onRetry={doctorsState.reload}
              />
            ) : (doctorsState.data ?? []).length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="Nenhum médico encontrado"
                description="Ajuste a especialidade ou o nome buscado para ver outros profissionais."
              />
            ) : (
              <div
                role="radiogroup"
                aria-label="Médicos disponíveis"
                className="grid gap-3 sm:grid-cols-2"
              >
                {(doctorsState.data ?? []).map((doctor) => {
                  const selected = selectedDoctor?.id === doctor.id;
                  return (
                    <button
                      key={doctor.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`doctor-option-${doctor.id}`}
                      onClick={() => handleSelectDoctor(doctor)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border bg-bg-elev p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500",
                        selected
                          ? "border-celeste-500 ring-1 ring-celeste-500"
                          : "border-borda hover:border-celeste-500/50",
                      )}
                    >
                      <Avatar name={doctor.name} size="md" />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-medium text-texto">
                          {doctor.name}
                        </span>
                        <span className="text-xs text-texto-2">
                          {doctor.specialty ?? "Especialidade não informada"}
                        </span>
                        <span className="font-data text-xs text-texto-3">
                          {formatCrm(doctor.crm)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleContinue} disabled={!selectedDoctor}>
                Continuar
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escolha o horário</CardTitle>
            <CardDescription>
              Horários de 30 minutos, de segunda a sexta, entre 09:00 e 17:00
              (horário de Brasília).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {selectedDoctor ? (
              <div className="flex items-center gap-3 rounded-lg border border-borda bg-bg-elev-2/40 p-3">
                <Avatar name={selectedDoctor.name} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-texto">
                    {selectedDoctor.name}
                  </span>
                  <span className="text-xs text-texto-2">
                    {selectedDoctor.specialty ?? "Especialidade não informada"}
                  </span>
                </div>
              </div>
            ) : null}

            {slotsState.loading ? (
              <p className="text-sm text-texto-3" role="status">
                Carregando horários disponíveis...
              </p>
            ) : slotsState.error ? (
              <ErrorState
                title="Não foi possível carregar os horários"
                description="A agenda do médico não pôde ser carregada. Tente novamente."
                onRetry={slotsState.reload}
              />
            ) : groupedSlots.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nenhum horário disponível"
                description="Todas as vagas dos próximos 21 dias foram preenchidas. Tente outro médico ou volte mais tarde."
                action={
                  <Button variant="secondary" onClick={slotsState.reload}>
                    Atualizar horários
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-5">
                {groupedSlots.map((group) => (
                  <div key={group.key} className="flex flex-col gap-2">
                    <h4 className="text-sm font-medium text-texto-2">
                      {group.label}
                    </h4>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      {group.slots.map((slot) => {
                        const selected =
                          selectedSlot?.startsAt === slot.startsAt;
                        return (
                          <button
                            key={slot.startsAt}
                            type="button"
                            data-slot={slot.startsAt}
                            aria-pressed={selected}
                            aria-label={`Selecionar horário de ${formatDateTimeWithContext(
                              slot.startsAt,
                            )}`}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              "rounded-pill border px-2 py-2 font-data text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500",
                              selected
                                ? "border-celeste-500 bg-celeste-500 text-white"
                                : "border-borda-forte text-texto hover:border-celeste-500",
                            )}
                          >
                            {formatTime(slot.startsAt)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={handleBack}>
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
              <Button onClick={handleContinue} disabled={!selectedSlot}>
                Continuar
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pré-consulta</CardTitle>
            <CardDescription>
              As respostas ajudam o médico a se preparar. Todos os campos são
              opcionais e ficam visíveis apenas para o profissional do
              atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {PRE_CONSULT_QUESTIONS.map((question) => (
              <Textarea
                key={question.key}
                label={question.label}
                placeholder={question.placeholder}
                value={answers[question.key] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.key]: event.target.value,
                  }))
                }
              />
            ))}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={handleBack}>
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
              <Button onClick={handleContinue}>
                Continuar
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && selectedDoctor && selectedSlot ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirme seu agendamento</CardTitle>
            <CardDescription>
              Revise os dados. Ao confirmar, o agendamento fica pendente até a
              validação por código de e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-texto-3">Médico</dt>
                <dd className="text-sm text-texto">{selectedDoctor.name}</dd>
                <dd className="text-xs text-texto-2">
                  {selectedDoctor.specialty ?? "Especialidade não informada"} ·{" "}
                  {formatCrm(selectedDoctor.crm)}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-texto-3">Data e horário</dt>
                <dd className="font-data text-sm text-texto">
                  {formatDateTimeWithContext(selectedSlot.startsAt)}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-texto-3">Modalidade</dt>
                <dd>
                  <Badge variant="brand">Teleconsulta</Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-texto-3">Pré-consulta</dt>
                <dd className="text-sm text-texto">
                  {answeredCount > 0
                    ? `${answeredCount} de ${PRE_CONSULT_QUESTIONS.length} respostas preenchidas`
                    : "Sem respostas preenchidas"}
                </dd>
              </div>
            </dl>

            {submitError ? (
              <Alert variant="error" title="Não foi possível agendar">
                {submitError}
              </Alert>
            ) : null}

            <div className="flex justify-between">
              <Button
                variant="secondary"
                onClick={handleBack}
                disabled={submitting}
              >
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                data-testid="confirm-booking"
              >
                {submitting ? "Agendando..." : "Confirmar agendamento"}
                {submitting ? null : <ArrowRight aria-hidden="true" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
