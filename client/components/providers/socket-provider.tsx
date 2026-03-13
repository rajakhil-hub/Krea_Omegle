"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { SocketContext } from "@/hooks/use-socket";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    const token = getCookie("authjs.session-token");
    if (!token) return;

    const s = connectSocket(token);
    setSocket(s);

    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => setIsConnected(false));
    s.on("connect_error", (err) => {
      console.error("[socket] Connection error:", err.message);
      setIsConnected(false);
    });
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session) {
      connect();
    }

    return () => {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    };
  }, [status, session, connect]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
