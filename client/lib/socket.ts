"use client";

import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./constants";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket | null {
  return socket;
}

export function connectSocket(token: string): TypedSocket {
  // Return existing socket regardless of state — Socket.IO handles reconnection
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  }) as TypedSocket;

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
