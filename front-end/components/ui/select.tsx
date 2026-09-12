"use client";

import {
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: readonly SelectOption[];
  placeholder?: string;
  leading?: ReactNode;
  containerClassName?: string;
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  leading,
  containerClassName,
  className,
  id,
  ...props
}: SelectProps) {
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
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-texto-3">
            {leading}
          </span>
        ) : null}
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-10 w-full appearance-none rounded-pill border bg-bg-elev text-sm text-texto transition-colors focus:outline-none focus-visible:outline-none focus:ring-[3px] disabled:opacity-45",
            leading ? "pl-11" : "pl-4",
            "pr-10",
            error
              ? "border-erro focus:border-erro focus:ring-erro/20"
              : "border-borda-forte focus:border-celeste-500 focus:ring-celeste-500/20",
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-texto-3"
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
