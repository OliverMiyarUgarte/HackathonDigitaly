"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  className,
}: ToggleProps) {
  const generatedId = useId();
  const toggleId = id ?? generatedId;
  const descriptionId = description ? `${toggleId}-description` : undefined;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-[30px] w-[52px] shrink-0 items-center rounded-pill border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-45",
          checked ? "bg-celeste-500" : "bg-grafite-600",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "block size-6 rounded-full bg-white shadow transition-transform duration-200 ease-brand",
            checked ? "translate-x-[25px]" : "translate-x-[3px]",
          )}
        />
      </button>
      {label ? (
        <span className="flex flex-col">
          <label htmlFor={toggleId} className="text-sm text-texto">
            {label}
          </label>
          {description ? (
            <span id={descriptionId} className="text-xs text-texto-3">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
