"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { SocketContext } from "@/hooks/use-socket";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function getCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const didConnectRef = useRef(false);

  // Connect once when authenticated — never reconnect on re-renders
  useEffect(() => {
    if (status === "authenticated" && !didConnectRef.current) {
      const token =
        getCookie("__Secure-authjs.session-token") ||
        getCookie("authjs.session-token");

      if (!token) {
        console.error("[socket] No auth cookie found. Cookies:", document.cookie.substring(0, 100));
        return;
      }

      const s = connectSocket(token);
      didConnectRef.current = true;
      setSocket(s);

      s.on("connect", () => { console.log("[socket] Connected:", s.id); setIsConnected(true); });
      s.on("disconnect", (reason) => { console.log("[socket] Disconnected:", reason); setIsConnected(false); });
      s.on("connect_error", (err) => { console.error("[socket] Connect error:", err.message); setIsConnected(false); });
    }

    if (status === "unauthenticated" && didConnectRef.current) {
      disconnectSocket();
      didConnectRef.current = false;
      setSocket(null);
      setIsConnected(false);
    }
  }, [status]);

  // Cleanup only on full unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
      didConnectRef.current = false;
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
