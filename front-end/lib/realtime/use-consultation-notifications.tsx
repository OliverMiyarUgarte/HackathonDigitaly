"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { get } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { doctorSummaryDtoSchema } from "@/lib/contracts";
import { useToast } from "@/components/ui/toast";
import { useRealtime } from "./socket-context";
import type { RealtimeEventPayload } from "./types";

const doctorListSchema = z.array(doctorSummaryDtoSchema);

function roomPath(role: "doctor" | "patient", consultationId: string): string {
  return role === "doctor"
    ? `/medico/consultas/${consultationId}`
    : `/paciente/consultas/${consultationId}`;
}

export function ConsultationNotifications() {
  const { socket, connectionState } = useRealtime();
  const { user } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !user) {
      return;
    }

    const resolveDoctorName = async (doctorId: string): Promise<string | null> => {
      try {
        const doctors = await get("/users/doctors", doctorListSchema);
        return doctors.find((doctor) => doctor.id === doctorId)?.name ?? null;
      } catch {
        return null;
      }
    };

    const onStarted = async (
      payload: RealtimeEventPayload<"consultation.started">,
    ): Promise<void> => {
      const key = `started:${payload.consultationId}`;
      if (seenRef.current.has(key)) {
        return;
      }
      seenRef.current.add(key);

      const path = roomPath(user.role, payload.consultationId);
      if (user.role === "doctor") {
        toast({
          variant: "info",
          title: "Atendimento iniciado",
          description: "A sala de atendimento está pronta para você.",
          action: { label: "Abrir sala", onClick: () => router.push(path) },
        });
        return;
      }

      const doctorName = await resolveDoctorName(payload.doctorId);
      toast({
        variant: "info",
        title: doctorName
          ? `${doctorName} iniciou o atendimento`
          : "Seu médico iniciou o atendimento",
        description: "Entre na sala para participar da teleconsulta.",
        action: { label: "Entrar na sala", onClick: () => router.push(path) },
      });
    };

    const onEnded = (
      payload: RealtimeEventPayload<"consultation.ended">,
    ): void => {
      const key = `ended:${payload.consultationId}`;
      if (seenRef.current.has(key)) {
        return;
      }
      seenRef.current.add(key);
      toast({
        variant: "info",
        title: "Atendimento encerrado",
        description: "A teleconsulta foi finalizada.",
      });
    };

    socket.on("consultation.started", onStarted);
    socket.on("consultation.ended", onEnded);

    return () => {
      socket.off("consultation.started", onStarted);
      socket.off("consultation.ended", onEnded);
    };
  }, [socket, user, toast, router]);

  return (
    <span
      hidden
      aria-hidden="true"
      data-testid="realtime-state"
      data-state={connectionState}
    />
  );
}
