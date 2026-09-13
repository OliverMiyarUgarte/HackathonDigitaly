import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-[68ch] text-balance text-texto">{title}</h1>
        {description ? (
          <p className="max-w-[68ch] text-texto-2">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Não foi possível carregar",
  description = "Tente novamente em instantes. Se o problema continuar, verifique sua conexão.",
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        ) : undefined
      }
    />
  );
}

export function LoadingIndicator({ label }: { label: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 text-sm text-texto-3"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin text-accent" />
      {label}
    </p>
  );
}

export function ListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-lg border border-borda bg-bg-elev p-4"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-24 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
