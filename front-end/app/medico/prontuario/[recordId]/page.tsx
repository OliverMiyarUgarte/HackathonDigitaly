"use client";

import { use } from "react";
import { MedicalRecordDetail } from "@/components/medico/medical-record-detail";

export default function MedicoRecordPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = use(params);
  return <MedicalRecordDetail recordId={recordId} />;
}
