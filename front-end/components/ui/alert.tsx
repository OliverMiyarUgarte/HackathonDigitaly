import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "info" | "success" | "warning" | "error";

const variantConfig: Record<
  AlertVariant,
  { border: string; background: string; icon: string; Icon: typeof Info }
> = {
  info: {
    border: "border-info/35",
    background: "bg-info/[0.08]",
    icon: "text-info",
    Icon: Info,
  },
  success: {
    border: "border-sucesso/35",
    background: "bg-sucesso/[0.08]",
    icon: "text-sucesso",
    Icon: CheckCircle2,
  },
  warning: {
    border: "border-alerta/35",
    background: "bg-alerta/[0.08]",
    icon: "text-alerta",
    Icon: AlertTriangle,
  },
  error: {
    border: "border-erro/35",
    background: "bg-erro/[0.08]",
    icon: "text-erro",
    Icon: XCircle,
  },
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title: string;
  children?: ReactNode;
}

export function Alert({
  variant = "info",
  title,
  className,
  children,
  ...props
}: AlertProps) {
  const config = variantConfig[variant];
  const Icon = config.Icon;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        config.border,
        config.background,
        className,
      )}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-[18px] shrink-0", config.icon)}
      />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-texto">{title}</p>
        {children ? (
          <div className="max-w-[68ch] text-sm text-texto-2">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
