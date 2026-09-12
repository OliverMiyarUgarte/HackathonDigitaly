"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-xl border border-borda bg-bg-elev p-0 text-texto backdrop:bg-black/60",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-xl font-medium">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-texto-2">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill text-texto-2 transition-colors hover:bg-bg-elev-2 hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {children}
        {footer ? (
          <div className="flex items-center justify-end gap-3">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
}
