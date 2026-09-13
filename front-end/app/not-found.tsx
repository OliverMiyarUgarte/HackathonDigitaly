import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <EmptyState
        icon={Compass}
        headingLevel="h1"
        title="Página não encontrada"
        description="O endereço acessado não existe ou foi movido. Volte ao início para continuar."
        action={
          <Link href="/" className={buttonClasses({ size: "md" })}>
            Voltar ao início
          </Link>
        }
      />
    </div>
  );
}
