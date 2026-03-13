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
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [debugInfo, setDebugInfo] = useState("init");
  const didConnectRef = useRef(false);

  // Connect once when authenticated — never reconnect on re-renders
  useEffect(() => {
    if (status === "authenticated" && !didConnectRef.current) {
      const token =
        getCookie("__Secure-authjs.session-token") ||
        getCookie("authjs.session-token");

      if (!token) {
        setDebugInfo("session=authenticated but NO cookie found. cookies: " + document.cookie.substring(0, 100));
        return;
      }

      setDebugInfo("connecting...");
      const s = connectSocket(token);
      didConnectRef.current = true;
      setSocket(s);

      s.on("connect", () => {
        console.log("[socket] Connected:", s.id);
        setDebugInfo("connected: " + s.id);
        setIsConnected(true);
      });
      s.on("disconnect", (reason) => {
        console.log("[socket] Disconnected:", reason);
        setDebugInfo("disconnected: " + reason);
        setIsConnected(false);
      });
      s.on("connect_error", (err) => {
        console.error("[socket] Connection error:", err.message);
        setDebugInfo("connect_error: " + err.message);
        setIsConnected(false);
      });
    } else if (status !== "authenticated") {
      setDebugInfo("session=" + status);
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
    <SocketContext.Provider value={{ socket, isConnected, debugInfo }}>
      {children}
    </SocketContext.Provider>
  );
}
