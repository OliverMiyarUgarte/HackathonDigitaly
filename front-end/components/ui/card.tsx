import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "solid" | "glass" | "feature";

const variantClasses: Record<CardVariant, string> = {
  solid: "rounded-lg border border-borda bg-bg-elev",
  glass: "glass rounded-lg",
  feature:
    "rounded-xl [background-image:var(--grad-marca-profundo)] text-white",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export function Card({ variant = "solid", className, ...props }: CardProps) {
  return (
    <div
      className={cn(variantClasses[variant], "p-6", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-xl font-medium text-texto", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-texto-2", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex items-center justify-end gap-3", className)}
      {...props}
    />
  );
}
