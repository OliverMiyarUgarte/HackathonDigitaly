"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  leading,
  trailing,
  containerClassName,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex w-full flex-col gap-2", containerClassName)}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-texto-2">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-texto-3">
            {leading}
          </span>
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-10 w-full rounded-pill border bg-bg-elev text-sm text-texto transition-colors placeholder:text-texto-3 focus:outline-none focus-visible:outline-none focus:ring-[3px] disabled:opacity-45",
            leading ? "pl-11" : "pl-4",
            trailing ? "pr-11" : "pr-4",
            error
              ? "border-erro focus:border-erro focus:ring-erro/20"
              : "border-borda-forte focus:border-celeste-500 focus:ring-celeste-500/20",
            className,
          )}
          {...props}
        />
        {trailing ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-erro">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-texto-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
