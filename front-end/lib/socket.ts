import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@telemed/service-contracts";
import { API_BASE_URL, getAccessToken } from "./api";

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_ORIGIN = (process.env.NEXT_PUBLIC_SOCKET_URL ?? "").replace(/\/+$/, "");

let socket: RealtimeSocket | null = null;

function namespaceUrl(): string {
  if (SOCKET_ORIGIN) {
    return SOCKET_ORIGIN.endsWith("/realtime")
      ? SOCKET_ORIGIN
      : `${SOCKET_ORIGIN}/realtime`;
  }
  const base = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${base}/realtime`;
}

export function getRealtimeSocket(): RealtimeSocket {
  if (socket) {
    return socket;
  }
  socket = io(namespaceUrl(), {
    autoConnect: false,
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,
    auth: (callback) => callback({ token: getAccessToken() ?? "" }),
  });
  return socket;
}

export function connectRealtimeSocket(): RealtimeSocket {
  const instance = getRealtimeSocket();
  if (!instance.connected) {
    instance.connect();
  }
  return instance;
}

export function disconnectRealtimeSocket(): void {
  if (!socket) {
    return;
  }
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
