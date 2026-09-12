"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionLoading, useSession } from "@/lib/auth";

export function SessionRedirect() {
  const { user, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (!user) {
      router.replace("/entrar");
      return;
    }
    router.replace(user.role === "doctor" ? "/medico" : "/paciente");
  }, [status, user, router]);

  return <SessionLoading label="Redirecionando para a sua área" />;
}
