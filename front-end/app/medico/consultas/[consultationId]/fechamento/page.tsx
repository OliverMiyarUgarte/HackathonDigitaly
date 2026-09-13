"use client";

import { use } from "react";
import { ConsultationClosing } from "@/components/medico/consultation-closing";

export default function MedicoConsultationClosingPage({
  params,
}: {
  params: Promise<{ consultationId: string }>;
}) {
  const { consultationId } = use(params);
  return <ConsultationClosing consultationId={consultationId} />;
}
