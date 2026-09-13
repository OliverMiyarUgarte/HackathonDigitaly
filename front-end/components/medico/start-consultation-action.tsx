"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, LogIn, Video } from "lucide-react";
import { Button, buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ApiError, get, post } from "@/lib/api";
import { doctorAppointmentListSchema, startConsultationResponseSchema, type DoctorAppointmentDto } from "@/lib/contracts";
import { useToast } from "@/lib/hooks";

export interface StartConsultationActionProps {
  appointment: DoctorAppointmentDto;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  onChanged?: () => void;
}

export function StartConsultationAction({
  appointment,
  size = "md",
  variant = "primary",
  className,
  onChanged,
}: StartConsultationActionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (appointment.status === "in_progress" && appointment.consultationId) {
    return (
      <Link
        href={`/medico/consultas/${appointment.consultationId}`}
        data-testid={`join-consultation-${appointment.appointmentId}`}
        className={buttonClasses({ variant, size, className })}
      >
        <Video aria-hidden="true" />
        Entrar na sala
      </Link>
    );
  }

  if (appointment.status !== "confirmed") {
    return (
      <Button
        variant="secondary"
        size={size}
        disabled
        className={className}
        title="Disponível quando o paciente confirmar o agendamento por código."
      >
        <Clock aria-hidden="true" />
        Aguardando confirmação
      </Button>
    );
  }

  const resolveExisting = async (): Promise<void> => {
    try {
      const list = await get("/appointments/doctor", doctorAppointmentListSchema);
      const match = list.find(
        (item) => item.appointmentId === appointment.appointmentId,
      );
      const consultationId =
        match?.consultationId ?? appointment.consultationId ?? null;
      if (consultationId) {
        setConfirmOpen(false);
        toast({
          variant: "info",
          title: "Atendimento já iniciado",
          description: "Abrindo a sala que já está aberta para este paciente.",
        });
        router.push(`/medico/consultas/${consultationId}`);
        return;
      }
      toast({
        variant: "warning",
        title: "Atendimento já iniciado",
        description: "Atualize a lista para abrir a sala existente.",
      });
      onChanged?.();
    } catch {
      toast({
        variant: "error",
        title: "Não foi possível abrir a sala",
        description: "Atualize a página e tente novamente.",
      });
    } finally {
      setPending(false);
    }
  };

  const handleStart = async (): Promise<void> => {
    setPending(true);
    try {
      const started = await post(
        `/appointments/${appointment.appointmentId}/consultations/start`,
        undefined,
        startConsultationResponseSchema,
      );
      setConfirmOpen(false);
      toast({
        variant: "success",
        title: "Teleatendimento iniciado",
        description: "A sala foi aberta para você e para o paciente.",
      });
      router.push(`/medico/consultas/${started.consultationId}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONSULTATION_EXISTS") {
        await resolveExisting();
        return;
      }
      if (
        error instanceof ApiError &&
        error.code === "APPOINTMENT_NOT_CONFIRMED"
      ) {
        toast({
          variant: "error",
          title: "Consulta ainda não confirmada",
          description:
            "O paciente precisa validar o código do agendamento antes do início.",
        });
      } else {
        toast({
          variant: "error",
          title: "Não foi possível iniciar",
          description: "Tente novamente em instantes.",
        });
      }
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        data-testid={`start-consultation-${appointment.appointmentId}`}
        onClick={() => setConfirmOpen(true)}
      >
        <Video aria-hidden="true" />
        Iniciar teleatendimento
      </Button>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) {
            setConfirmOpen(open);
          }
        }}
        title="Iniciar teleatendimento"
        description="A sala será aberta para você e para o paciente. Confirme para continuar."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleStart()} disabled={pending}>
              {pending ? "Iniciando..." : "Iniciar teleatendimento"}
              {pending ? null : <ArrowRight aria-hidden="true" />}
            </Button>
          </>
        }
      >
        <p className="flex items-center gap-2 text-sm text-texto-2">
          <LogIn aria-hidden="true" className="size-4 text-celeste-500" />
          {appointment.patient.name} será notificado para entrar na sala.
        </p>
      </Dialog>
    </>
  );
}
