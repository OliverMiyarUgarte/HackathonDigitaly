import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-borda-forte bg-bg-elev/50 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-celeste-500/14 text-celeste-500">
          <Icon aria-hidden="true" className="size-6" />
        </span>
      ) : null}
      <h3 className="text-lg font-medium text-texto">{title}</h3>
      {description ? (
        <p className="max-w-[52ch] text-sm text-texto-2">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
