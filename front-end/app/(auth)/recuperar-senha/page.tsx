import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

export default function RecuperarSenhaPage() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Recuperar acesso</CardTitle>
        <CardDescription>
          A redefinição de senha ainda não está disponível nesta versão.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Alert variant="info" title="O que fazer agora">
          Peça ao administrador da clínica para redefinir sua senha. Cadastre
          ou confirme o e-mail usado na sua conta para agilizar o atendimento.
        </Alert>

        <ul className="flex flex-col gap-3 text-sm text-texto-2">
          <li className="flex items-start gap-3">
            <Mail
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-celeste-500"
            />
            <span>
              Informe o e-mail da conta para o administrador localizar seu
              cadastro.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <KeyRound
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-celeste-500"
            />
            <span>
              Após a redefinição, entre com a nova senha e atualize seus dados
              no perfil.
            </span>
          </li>
        </ul>

        <Link
          href="/entrar"
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          Voltar para o login
        </Link>
      </CardContent>
    </Card>
  );
}
