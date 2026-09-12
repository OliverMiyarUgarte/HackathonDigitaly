import { RoleLanding } from "@/components/shell/role-landing";

const NEXT_STEPS = [
  {
    title: "Agendar consulta",
    description: "Escolha o médico, o horário e confirme com o código enviado por e-mail.",
  },
  {
    title: "Calendário",
    description: "Acompanhe consultas confirmadas e receba o aviso para entrar na sala.",
  },
  {
    title: "Histórico",
    description: "Consulte atendimentos anteriores e orientações registradas.",
  },
] as const;

export default function PacientePage() {
  return (
    <RoleLanding
      role="patient"
      title="Área do paciente"
      description="Aqui você acompanha suas consultas e entra na sala quando o médico iniciar o atendimento."
      nextSteps={NEXT_STEPS}
    />
  );
}
