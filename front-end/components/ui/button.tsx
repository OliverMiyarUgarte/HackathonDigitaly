import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "glass";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium transition-[background-color,border-color,color,box-shadow] duration-200 ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "[background-image:var(--grad-marca)] text-white hover:shadow-[0_0_0_3px_rgba(0,159,255,0.22)]",
  secondary:
    "border border-borda-forte bg-transparent text-texto hover:border-celeste-500",
  ghost: "bg-transparent text-texto-2 hover:bg-bg-elev-2 hover:text-texto",
  glass: "glass text-texto",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: ButtonClassOptions = {}): string {
  return cn(base, variantClasses[variant], sizeClasses[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}
