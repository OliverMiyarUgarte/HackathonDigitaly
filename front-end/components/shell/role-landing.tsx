"use client";

import { Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/lib/auth";
import type { UserRole } from "@/lib/contracts";
import { ROLE_LABEL } from "./nav-config";

export interface RoleLandingProps {
  role: UserRole;
  title: string;
  description: string;
  nextSteps: readonly { title: string; description: string }[];
}

export function RoleLanding({
  role,
  title,
  description,
  nextSteps,
}: RoleLandingProps) {
  const { user } = useSession();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar name={user?.name ?? "Usuário"} size="lg" />
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-texto">
                {user?.name ?? "Sessão ativa"}
              </p>
              <p className="text-sm text-texto-2">
                {user?.email ?? "E-mail indisponível"}
              </p>
              <div className="mt-1">
                <Badge variant="brand">{ROLE_LABEL[role]}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EmptyState
        icon={Sparkles}
        title="Próximos passos"
        description="As telas de atendimento entram nas próximas tarefas. A fundação de sessão, navegação e componentes já está pronta."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nextSteps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-lg">{step.title}</CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
