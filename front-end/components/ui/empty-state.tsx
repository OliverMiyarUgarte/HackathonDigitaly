import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  headingLevel?: "h1" | "h2";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  headingLevel = "h2",
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-borda-forte bg-bg-elev/50 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-celeste-500/14 text-accent">
          <Icon aria-hidden="true" className="size-6" />
        </span>
      ) : null}
      <Heading className="text-lg font-medium text-texto">{title}</Heading>
      {description ? (
        <p className="max-w-[68ch] text-sm text-texto-2">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
