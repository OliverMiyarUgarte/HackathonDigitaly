"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RecordsHistory } from "@/components/medico/records-history";
import { SessionLoading } from "@/lib/auth";

function RecordsHistoryContent() {
  const searchParams = useSearchParams();
  return <RecordsHistory patientId={searchParams.get("patientId")} />;
}

export default function MedicoProntuarioPage() {
  return (
    <Suspense fallback={<SessionLoading label="Carregando prontuário" />}>
      <RecordsHistoryContent />
    </Suspense>
  );
}
