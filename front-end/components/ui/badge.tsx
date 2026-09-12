import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  brand: "bg-celeste-500/14 text-celeste-600 dark:text-celeste-400",
  success: "bg-sucesso/14 text-sucesso",
  warning: "bg-alerta/14 text-alerta",
  error: "bg-erro/14 text-erro",
  neutral: "bg-bg-elev-2 text-texto-2",
  outline: "border border-borda-forte text-texto-2",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  live?: boolean;
  children: ReactNode;
}

export function Badge({
  variant = "neutral",
  live = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {live ? (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current motion-safe:animate-pulse"
        />
      ) : null}
      {children}
    </span>
  );
}
