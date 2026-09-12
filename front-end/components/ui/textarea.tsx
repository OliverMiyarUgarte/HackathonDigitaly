"use client";

import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  leading?: ReactNode;
  containerClassName?: string;
}

export function Textarea({
  label,
  error,
  hint,
  leading,
  containerClassName,
  className,
  id,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex w-full flex-col gap-2", containerClassName)}>
      {label ? (
        <label htmlFor={fieldId} className="text-sm font-medium text-texto-2">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-4 top-4 text-texto-3">
            {leading}
          </span>
        ) : null}
        <textarea
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "min-h-24 w-full resize-y rounded-lg border bg-bg-elev px-[16px] py-[11px] text-sm text-texto transition-colors placeholder:text-texto-3 focus:outline-none focus-visible:outline-none focus:ring-[3px] disabled:opacity-45",
            leading ? "pl-11" : undefined,
            error
              ? "border-erro focus:border-erro focus:ring-erro/20"
              : "border-borda-forte focus:border-celeste-500 focus:ring-celeste-500/20",
            className,
          )}
          {...props}
        />
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
