"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  idPrefix: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs deve ser usado dentro de Tabs");
  }
  return context;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const idPrefix = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = value ?? internalValue;

  const setValue = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider
      value={{ value: currentValue, setValue, idPrefix }}
    >
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  onKeyDown,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }
    const navigationKeys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!navigationKeys.includes(event.key)) {
      return;
    }
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not([disabled])',
      ),
    );
    if (tabs.length === 0) {
      return;
    }
    const currentIndex = tabs.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else {
      nextIndex = tabs.length - 1;
    }
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border border-borda bg-bg-elev p-1",
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps
  extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const { value: currentValue, setValue, idPrefix } = useTabsContext();
  const active = currentValue === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${idPrefix}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${idPrefix}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        "inline-flex h-8 items-center rounded-pill px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500",
        active
          ? "bg-celeste-500 text-white"
          : "text-texto-2 hover:text-texto",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value: currentValue, idPrefix } = useTabsContext();
  if (currentValue !== value) {
    return null;
  }
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      tabIndex={0}
      className={cn("mt-4 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
