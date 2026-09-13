"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { loginRequestSchema } from "@/lib/contracts";

interface FieldErrors {
  email?: string;
  password?: string;
}

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  INVALID_CREDENTIALS:
    "E-mail ou senha incorretos. Confira os dados e tente novamente.",
  RATE_LIMITED:
    "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.",
  VALIDATION_FAILED:
    "Alguns campos precisam de correção antes de continuar.",
  INTERNAL_ERROR:
    "Não foi possível entrar agora. Tente novamente em instantes.",
};

export default function EntrarPage() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const validateField = (field: "email" | "password", value: string): void => {
    const parsed = loginRequestSchema.shape[field].safeParse(value);
    setFieldErrors((current) => ({
      ...current,
      [field]: parsed.success ? undefined : parsed.error.issues[0]?.message,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" && !errors.email) {
          errors.email = issue.message;
        }
        if (key === "password" && !errors.password) {
          errors.password = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const user = await login(parsed.data);
      router.replace(user.role === "doctor" ? "/medico" : "/paciente");
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(ERROR_MESSAGES[error.code] ?? error.message);
      } else {
        setFormError(
          "Não foi possível entrar agora. Verifique sua conexão e tente novamente.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle level="h1" className="text-3xl">
          Entrar no teleatendimento
        </CardTitle>
        <CardDescription>
          Use o e-mail e a senha da sua conta. O perfil de paciente ou médico é
          identificado automaticamente pelo cadastro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          {formError ? (
            <Alert variant="error" title="Não foi possível entrar">
              {formError}
            </Alert>
          ) : null}

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={(event) => validateField("email", event.target.value)}
            error={fieldErrors.email}
            leading={<Mail aria-hidden="true" className="size-4" />}
          />

          <Input
            label="Senha"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={(event) => validateField("password", event.target.value)}
            error={fieldErrors.password}
            leading={<Lock aria-hidden="true" className="size-4" />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="inline-flex size-10 items-center justify-center rounded-pill text-texto-3 transition-colors hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            }
          />

          <div className="flex items-center justify-end">
            <Link
              href="/recuperar-senha"
              className="text-xs font-medium text-accent hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full"
          >
            {submitting ? "Entrando..." : "Entrar na plataforma"}
            {submitting ? null : (
              <ArrowRight aria-hidden="true" className="size-4" />
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-texto-2">
          Ainda não tem conta?{" "}
          <Link
            href="/registro"
            className="font-medium text-accent hover:underline"
          >
            Criar conta de paciente
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
