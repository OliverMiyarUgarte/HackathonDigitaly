"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react";
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
import { registerRequestSchema } from "@/lib/contracts";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  EMAIL_TAKEN: "Este e-mail já está cadastrado.",
  RATE_LIMITED:
    "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.",
  VALIDATION_FAILED:
    "Alguns campos precisam de correção antes de continuar.",
  INTERNAL_ERROR:
    "Não foi possível criar a conta agora. Tente novamente em instantes.",
};

export default function RegistroPage() {
  const router = useRouter();
  const { register } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = registerRequestSchema.safeParse({
      name,
      email,
      password,
      role: "patient",
    });

    const errors: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name" && !errors.name) {
          errors.name = issue.message;
        }
        if (key === "email" && !errors.email) {
          errors.email = issue.message;
        }
        if (key === "password" && !errors.password) {
          errors.password = issue.message;
        }
      }
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = "As senhas não coincidem. Repita a mesma senha.";
    }
    if (!parsed.success || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const user = await register(parsed.data);
      router.replace(user.role === "doctor" ? "/medico" : "/paciente");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "EMAIL_TAKEN") {
          setFieldErrors({
            email: "Este e-mail já está cadastrado. Use outro e-mail.",
          });
        } else {
          setFormError(ERROR_MESSAGES[error.code] ?? error.message);
        }
      } else {
        setFormError(
          "Não foi possível criar a conta agora. Verifique sua conexão e tente novamente.",
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
          Criar conta de paciente
        </CardTitle>
        <CardDescription>
          Preencha os dados para agendar consultas e acompanhar seu histórico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert
          variant="info"
          title="Cadastro de médicos"
          className="mb-5"
        >
          O acesso de médicos é liberado pela equipe Digitaly. Fale com o
          administrador da clínica para receber suas credenciais.
        </Alert>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          {formError ? (
            <Alert variant="error" title="Não foi possível criar a conta">
              {formError}
            </Alert>
          ) : null}

          <Input
            label="Nome completo"
            autoComplete="name"
            placeholder="Como você quer ser chamado"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldErrors.name}
            leading={<User aria-hidden="true" className="size-4" />}
          />

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            leading={<Mail aria-hidden="true" className="size-4" />}
          />

          <Input
            label="Senha"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Ao menos 8 caracteres"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            hint="Use 8 caracteres ou mais para proteger seus dados."
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

          <Input
            label="Confirmar senha"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repita a senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={fieldErrors.confirmPassword}
            leading={<Lock aria-hidden="true" className="size-4" />}
          />

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full"
          >
            {submitting ? "Criando conta..." : "Criar conta"}
            {submitting ? null : (
              <ArrowRight aria-hidden="true" className="size-4" />
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-texto-2">
          Já tem conta?{" "}
          <Link
            href="/entrar"
            className="font-medium text-accent hover:underline"
          >
            Entrar na plataforma
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
