"use client";

import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 6;

export interface CodeInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onComplete?: () => void;
}

export function CodeInput({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
  onComplete,
}: CodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const applyDigits = (index: number, raw: string): void => {
    const digits = raw.replace(/\D/g, "");
    const next = [...value];
    if (!digits) {
      next[index] = "";
      onChange(next);
      return;
    }
    let cursor = index;
    for (const digit of digits) {
      if (cursor >= CODE_LENGTH) {
        break;
      }
      next[cursor] = digit;
      cursor += 1;
    }
    onChange(next);
    const focusIndex = Math.min(cursor, CODE_LENGTH - 1);
    refs.current[focusIndex]?.focus();
    if (next.every((digit) => digit !== "")) {
      onComplete?.();
    }
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      event.preventDefault();
      const next = [...value];
      next[index - 1] = "";
      onChange(next);
      refs.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (
    index: number,
    event: ClipboardEvent<HTMLInputElement>,
  ): void => {
    event.preventDefault();
    applyDigits(index, event.clipboardData.getData("text"));
  };

  return (
    <div
      role="group"
      aria-label="Código de validação de 6 dígitos"
      aria-describedby={describedBy}
      className="flex flex-wrap gap-2"
    >
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`Dígito ${index + 1} de ${CODE_LENGTH}`}
          aria-invalid={invalid ? true : undefined}
          data-testid={`code-input-${index}`}
          onChange={(event) => applyDigits(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
          className={cn(
            "h-12 w-11 rounded-pill border bg-bg-elev text-center font-data text-lg text-texto transition-colors focus:outline-none focus:ring-[3px] disabled:opacity-45",
            invalid
              ? "border-erro focus:border-erro focus:ring-erro/20"
              : "border-borda-forte focus:border-celeste-500 focus:ring-celeste-500/20",
          )}
        />
      ))}
    </div>
  );
}
