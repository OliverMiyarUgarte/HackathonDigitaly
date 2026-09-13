"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses, Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, get, post } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  appointmentSchema,
  requestCodeResponseSchema,
  type AppointmentDto,
  type RequestCodeResponseDto,
} from "@/lib/contracts";
import { formatDateTimeWithContext } from "@/lib/format";
import { maskEmail } from "@/lib/appointments";
import { useAsyncWithKey, useToast } from "@/lib/hooks";
import { CodeInput } from "./code-input";
import { ErrorState, LoadingIndicator } from "./section-states";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const MAILHOG_URL = "http://localhost:8025";
const GENERIC_CODE_ERROR =
  "Código inválido ou expirado. Confira o código e tente novamente.";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function emptyCode(): string[] {
  return Array.from({ length: CODE_LENGTH }, () => "");
}

export interface ConfirmAppointmentProps {
  appointmentId: string;
}

export function ConfirmAppointment({
  appointmentId,
}: ConfirmAppointmentProps) {
  const { user } = useSession();
  const { toast } = useToast();
  const [code, setCode] = useState<string[]>(emptyCode);
  const [codeInfo, setCodeInfo] = useState<RequestCodeResponseDto | null>(null);
  const [confirmed, setConfirmed] = useState<AppointmentDto | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const requestedRef = useRef(false);

  const appointmentState = useAsyncWithKey(
    () => get(`/appointments/${appointmentId}`, appointmentSchema),
    appointmentId,
  );

  const requestCode = useCallback(
    async (isResend: boolean): Promise<void> => {
      setRequesting(true);
      setRequestError(null);
      setVerifyError(null);
      try {
        const path = isResend
          ? `/appointments/${appointmentId}/resend-code`
          : `/appointments/${appointmentId}/request-code`;
        const result = await post(path, undefined, requestCodeResponseSchema);
        setCodeInfo(result);
        setCode(emptyCode());
        setSecondsLeft(
          Math.max(
            0,
            Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000),
          ),
        );
        if (isResend) {
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
          toast({
            variant: "info",
            title: "Novo código enviado",
            description: "Confira o e-mail e informe o código atualizado.",
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === "RATE_LIMITED") {
          setRequestError(
            "Muitas solicitações em pouco tempo. Aguarde um minuto e tente novamente.",
          );
        } else {
          setRequestError(
            "Não foi possível enviar o código agora. Verifique sua conexão e tente novamente.",
          );
        }
      } finally {
        setRequesting(false);
      }
    },
    [appointmentId, toast],
  );

  useEffect(() => {
    const status = appointmentState.data?.status;
    if (status !== "pending_code" || requestedRef.current) {
      return;
    }
    requestedRef.current = true;
    void requestCode(false);
  }, [appointmentState.data, requestCode]);

  useEffect(() => {
    if (!codeInfo) {
      return;
    }
    const deadline = new Date(codeInfo.expiresAt).getTime();
    const tick = (): void => {
      setSecondsLeft(
        Math.max(0, Math.floor((deadline - Date.now()) / 1000)),
      );
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [codeInfo]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setResendCooldown((current) => current - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [resendCooldown]);

  const handleVerify = async (): Promise<void> => {
    const value = code.join("");
    if (!/^\d{6}$/.test(value)) {
      setVerifyError("Informe os 6 dígitos do código enviado por e-mail.");
      return;
    }
    if (secondsLeft <= 0) {
      setVerifyError("O código expirou. Reenvie um novo código para continuar.");
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await post(
        `/appointments/${appointmentId}/verify-code`,
        { code: value },
        appointmentSchema,
      );
      setConfirmed(result);
      toast({
        variant: "success",
        title: "Agendamento confirmado",
        description: "Sua consulta está confirmada e aparece no calendário.",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "INVALID_OR_EXPIRED_CODE") {
          setVerifyError(GENERIC_CODE_ERROR);
          setCodeInfo((current) =>
            current
              ? {
                  ...current,
                  attemptsRemaining: Math.max(0, current.attemptsRemaining - 1),
                }
              : current,
          );
          setCode(emptyCode());
        } else if (error.code === "TOO_MANY_ATTEMPTS") {
          setVerifyError(
            "Muitas tentativas incorretas. Reenvie um novo código para continuar.",
          );
          setCodeInfo((current) =>
            current ? { ...current, attemptsRemaining: 0 } : current,
          );
          setCode(emptyCode());
        } else if (error.code === "RATE_LIMITED") {
          setVerifyError(
            "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.",
          );
        } else {
          setVerifyError(
            "Não foi possível validar o código agora. Tente novamente.",
          );
        }
      } else {
        setVerifyError(
          "Não foi possível validar o código agora. Verifique sua conexão e tente novamente.",
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  if (appointmentState.loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (appointmentState.error || !appointmentState.data) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Agendamento não encontrado</h1>
        <ErrorState
          title="Agendamento não encontrado"
          description="Não foi possível localizar este agendamento. Volte ao calendário e tente novamente."
          onRetry={appointmentState.reload}
        />
      </div>
    );
  }

  const appointment = appointmentState.data;

  if (confirmed || appointment.status === "confirmed" || appointment.status === "in_progress" || appointment.status === "completed") {
    const current = confirmed ?? appointment;
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden="true" className="size-5 text-sucesso" />
              <Badge variant="success">Confirmada</Badge>
            </div>
            <CardTitle level="h1" className="text-3xl">
              Agendamento confirmado
            </CardTitle>
            <CardDescription>
              A consulta está confirmada. Você receberá um aviso quando o médico
              iniciar a sala.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="inline-flex items-center gap-2 font-data text-lg text-texto">
              <Clock aria-hidden="true" className="size-4 text-texto-3" />
              {formatDateTimeWithContext(current.scheduledAt)}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/paciente/calendario"
                className={buttonClasses({ variant: "primary" })}
              >
                <CalendarCheck aria-hidden="true" />
                Ver no calendário
              </Link>
              <Link
                href="/paciente"
                className={buttonClasses({ variant: "secondary" })}
              >
                Voltar ao início
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appointment.status === "cancelled") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto">Agendamento cancelado</h1>
        <Alert variant="warning" title="Agendamento cancelado">
          Este agendamento foi cancelado e não pode mais ser confirmado. Agende
          um novo horário para continuar.
        </Alert>
      </div>
    );
  }

  const attemptsRemaining = codeInfo?.attemptsRemaining ?? null;
  const outOfAttempts = attemptsRemaining !== null && attemptsRemaining <= 0;
  const expired = Boolean(codeInfo) && secondsLeft <= 0;
  const verifyDisabled =
    verifying || requesting || expired || outOfAttempts || !codeInfo;
  const resendDisabled = requesting || resendCooldown > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-[68ch] text-balance text-texto">
          Confirme com o código
        </h1>
        <p className="max-w-[68ch] text-texto-2">
          Enviamos um código de 6 dígitos para{" "}
          <span className="font-medium text-texto">
            {maskEmail(user?.email)}
          </span>
          . Informe o código para confirmar a consulta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail aria-hidden="true" className="size-4 text-accent" />
            <CardTitle className="text-lg">Código de validação</CardTitle>
          </div>
          <CardDescription>
            {formatDateTimeWithContext(appointment.scheduledAt)} · Teleconsulta
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {requestError ? (
            <Alert variant="error" title="Não foi possível enviar o código">
              <div className="flex flex-col items-start gap-3">
                <span>{requestError}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void requestCode(false)}
                  disabled={requesting}
                >
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          ) : null}

          {requesting && !codeInfo ? (
            <LoadingIndicator label="Enviando código de validação" />
          ) : null}

          {codeInfo ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm text-texto-2">
                  <Clock aria-hidden="true" className="size-4" />
                  {expired
                    ? "Código expirado"
                    : `Expira em ${formatCountdown(secondsLeft)}`}
                </span>
                {attemptsRemaining !== null ? (
                  <Badge variant={outOfAttempts ? "error" : "outline"}>
                    {outOfAttempts
                      ? "Sem tentativas restantes"
                      : `Tentativas restantes: ${attemptsRemaining}`}
                  </Badge>
                ) : null}
              </div>

              <CodeInput
                value={code}
                onChange={setCode}
                disabled={verifying || outOfAttempts}
                invalid={Boolean(verifyError)}
                describedBy="code-feedback"
              />

              <div
                id="code-feedback"
                aria-live="polite"
                className="min-h-5 text-sm"
              >
                {verifyError ? (
                  <span className="text-erro">{verifyError}</span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCode(emptyCode());
                    void requestCode(true);
                  }}
                  disabled={resendDisabled}
                  data-testid="resend-code"
                >
                  <RefreshCw aria-hidden="true" />
                  {resendCooldown > 0
                    ? `Reenviar em ${resendCooldown}s`
                    : "Reenviar código"}
                </Button>
                <Button
                  onClick={() => void handleVerify()}
                  disabled={verifyDisabled}
                  data-testid="verify-code"
                >
                  {verifying ? "Validando..." : "Confirmar código"}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Alert variant="info" title="Código de demonstração">
        <span className="inline-flex flex-wrap items-center gap-2">
          Em desenvolvimento, o e-mail com o código fica disponível no MailHog.
          <a
            href={MAILHOG_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Abrir MailHog
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </span>
      </Alert>

      <p className="inline-flex items-center gap-2 text-xs text-texto-3">
        <ShieldCheck aria-hidden="true" className="size-3.5" />
        Nunca compartilhe este código. Ele confirma apenas este agendamento.
      </p>
    </div>
  );
}
