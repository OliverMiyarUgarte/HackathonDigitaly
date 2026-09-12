"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClasses: Record<ToastVariant, string> = {
  info: "border-info/35",
  success: "border-sucesso/35",
  warning: "border-alerta/35",
  error: "border-erro/35",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "info",
      };
      setToasts((current) => [...current, item]);
      window.setTimeout(() => dismiss(id), input.duration ?? 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-bg-elev p-4 shadow-lg",
              variantClasses[item.variant],
            )}
          >
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium text-texto">{item.title}</p>
              {item.description ? (
                <p className="text-sm text-texto-2">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Fechar notificação"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill text-texto-2 transition-colors hover:bg-bg-elev-2 hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de ToastProvider");
  }
  return context;
}
