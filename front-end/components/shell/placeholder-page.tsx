import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium text-texto">{title}</h2>
        <p className="max-w-[68ch] text-texto-2">{description}</p>
      </div>
      <EmptyState
        icon={Construction}
        title="Em construção"
        description="Esta tela entra em uma próxima tarefa. Nenhum dado real é exibido e nenhuma ação está disponível por enquanto."
      />
    </div>
  );
}
