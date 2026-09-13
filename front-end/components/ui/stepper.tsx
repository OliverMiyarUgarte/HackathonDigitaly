import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: readonly Step[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6",
        className,
      )}
    >
      <li className="sr-only" aria-live="polite">
        {`Etapa ${current + 1} de ${steps.length}: ${
          steps[current]?.label ?? ""
        }`}
      </li>
      {steps.map((step, index) => {
        const state =
          index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            className="flex flex-1 items-start gap-3"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                state === "current"
                  ? "border-celeste-500 bg-celeste-500 text-white"
                  : state === "done"
                    ? "border-celeste-500 text-accent"
                    : "border-borda-forte text-texto-3",
              )}
            >
              {index + 1}
            </span>
            <span className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-medium",
                  state === "upcoming" ? "text-texto-3" : "text-texto",
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="text-xs text-texto-3">
                  {step.description}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
