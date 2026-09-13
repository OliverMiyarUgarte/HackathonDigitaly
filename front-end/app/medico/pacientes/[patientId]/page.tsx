"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { PatientOverview } from "@/components/medico/patient-overview";
import { SessionLoading } from "@/lib/auth";

function PatientOverviewContent({ patientId }: { patientId: string }) {
  const searchParams = useSearchParams();
  return (
    <PatientOverview
      patientId={patientId}
      appointmentId={searchParams.get("appointmentId")}
    />
  );
}

export default function MedicoPatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  return (
    <Suspense fallback={<SessionLoading label="Carregando paciente" />}>
      <PatientOverviewContent patientId={patientId} />
    </Suspense>
  );
}
