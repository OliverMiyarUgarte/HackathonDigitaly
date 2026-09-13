"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAccessToken, onSessionExpired, refreshAccessToken } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  getRealtimeSocket,
  type RealtimeSocket,
} from "@/lib/socket";
import type { RealtimeConnectionState } from "./types";

export interface RealtimeContextValue {
  socket: RealtimeSocket | null;
  connectionState: RealtimeConnectionState;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [socket, setSocket] = useState<RealtimeSocket | null>(null);
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("idle");
  const activeRef = useRef(false);
  const refreshingRef = useRef(false);

  const recoverWithFreshToken = useCallback(async () => {
    if (refreshingRef.current || !activeRef.current) {
      return;
    }
    refreshingRef.current = true;
    try {
      const refreshed = await refreshAccessToken();
      if (!activeRef.current) {
        return;
      }
      if (refreshed) {
        const instance = getRealtimeSocket();
        if (!instance.connected) {
          instance.connect();
        }
        return;
      }
      setConnectionState("failed");
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      activeRef.current = false;
      disconnectRealtimeSocket();
      setSocket(null);
      setConnectionState("idle");
    });
  }, []);

  useEffect(() => {
    const publish = (
      nextSocket: RealtimeSocket | null,
      nextState: RealtimeConnectionState,
    ): void => {
      queueMicrotask(() => {
        setSocket(nextSocket);
        setConnectionState(nextState);
      });
    };

    if (status !== "authenticated" || !getAccessToken()) {
      activeRef.current = false;
      disconnectRealtimeSocket();
      publish(null, "idle");
      return;
    }

    activeRef.current = true;
    const instance = connectRealtimeSocket();
    publish(instance, instance.connected ? "connected" : "connecting");

    const onConnect = () => {
      setConnectionState("connected");
    };
    const onDisconnect = (reason: string) => {
      if (!activeRef.current || reason === "io client disconnect") {
        return;
      }
      setConnectionState("reconnecting");
    };
    const onConnectError = () => {
      if (!activeRef.current) {
        return;
      }
      setConnectionState("reconnecting");
      void recoverWithFreshToken();
    };
    const manager = instance.io;
    const onReconnectAttempt = () => {
      if (activeRef.current) {
        setConnectionState("reconnecting");
      }
    };
    const onReconnect = () => {
      setConnectionState("connected");
    };
    const onReconnectFailed = () => {
      setConnectionState("failed");
    };

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    instance.on("connect_error", onConnectError);
    manager.on("reconnect_attempt", onReconnectAttempt);
    manager.on("reconnect", onReconnect);
    manager.on("reconnect_failed", onReconnectFailed);

    return () => {
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      instance.off("connect_error", onConnectError);
      manager.off("reconnect_attempt", onReconnectAttempt);
      manager.off("reconnect", onReconnect);
      manager.off("reconnect_failed", onReconnectFailed);
    };
  }, [status, recoverWithFreshToken]);

  const reconnect = useCallback(() => {
    void recoverWithFreshToken();
  }, [recoverWithFreshToken]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ socket, connectionState, reconnect }),
    [socket, connectionState, reconnect],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime deve ser usado dentro de RealtimeProvider");
  }
  return context;
}
