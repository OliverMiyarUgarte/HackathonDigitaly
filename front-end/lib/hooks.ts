"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";

export { useToast };

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Falha inesperada");
}

export function useAsync<T>(fn: () => Promise<T>, initialData: T | null = null) {
  const fnRef = useRef(fn);
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => fnRef.current())
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ data: null, loading: false, error: toError(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [version]);

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    setVersion((current) => current + 1);
  }, []);

  return { ...state, reload };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const onChange = () => {
      setMatches(mediaQueryList.matches);
    };
    onChange();
    mediaQueryList.addEventListener("change", onChange);
    return () => {
      mediaQueryList.removeEventListener("change", onChange);
    };
  }, [query]);

  return matches;
}
