"use client";

import { use } from "react";
import { ConsultationRoomPage } from "@/components/consultation/consultation-room-page";

export default function PacienteConsultationPage({
  params,
}: {
  params: Promise<{ consultationId: string }>;
}) {
  const { consultationId } = use(params);
  return <ConsultationRoomPage consultationId={consultationId} role="patient" />;
}
