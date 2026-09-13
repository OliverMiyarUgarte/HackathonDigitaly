import { PRE_CONSULT_QUESTIONS } from "@/lib/appointments";
import type { PreConsultAnswerDto } from "@/lib/contracts";

export interface PreConsultListProps {
  answers: readonly PreConsultAnswerDto[];
  emptyMessage?: string;
}

export function PreConsultList({
  answers,
  emptyMessage = "Nenhuma resposta de pré-consulta registrada para este atendimento.",
}: PreConsultListProps) {
  if (answers.length === 0) {
    return <p className="text-sm text-texto-2">{emptyMessage}</p>;
  }

  const byKey = new Map(
    answers.map((answer) => [answer.questionKey, answer.answer]),
  );

  return (
    <dl className="flex flex-col gap-3">
      {PRE_CONSULT_QUESTIONS.map((question) => {
        const answer = byKey.get(question.key);
        return (
          <div key={question.key} className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-texto-3">
              {question.label}
            </dt>
            <dd className="text-sm text-texto">
              {answer && answer.trim().length > 0 ? answer : "Não respondida"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
