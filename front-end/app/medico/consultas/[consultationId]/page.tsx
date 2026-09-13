"use client";

import { use } from "react";
import { ConsultationRoomPage } from "@/components/consultation/consultation-room-page";

export default function MedicoConsultationPage({
  params,
}: {
  params: Promise<{ consultationId: string }>;
}) {
  const { consultationId } = use(params);
  return <ConsultationRoomPage consultationId={consultationId} role="doctor" />;
}
