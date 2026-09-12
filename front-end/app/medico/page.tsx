import { RoleLanding } from "@/components/shell/role-landing";

const NEXT_STEPS = [
  {
    title: "Atendimentos",
    description: "Fila do dia com status, paciente e pré-consulta respondida.",
  },
  {
    title: "Prontuário",
    description: "Revise o histórico e as respostas da triagem antes da chamada.",
  },
  {
    title: "Copiloto",
    description: "Transcrição e sugestões em tempo real durante o teleatendimento.",
  },
] as const;

export default function MedicoPage() {
  return (
    <RoleLanding
      role="doctor"
      title="Área do médico"
      description="Aqui você acompanha a agenda e conduz o teleatendimento com apoio do copiloto."
      nextSteps={NEXT_STEPS}
    />
  );
}
