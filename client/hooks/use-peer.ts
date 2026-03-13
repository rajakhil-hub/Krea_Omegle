"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type SimplePeerType from "simple-peer";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types";
import { SOCKET_URL } from "@/lib/constants";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UsePeerOptions {
  localStream: MediaStream | null;
  socket: TypedSocket | null;
  isInitiator: boolean;
  partnerId: string;
}

export function usePeer({
  localStream,
  socket,
  isInitiator,
  partnerId,
}: UsePeerOptions) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<SimplePeerType.Instance | null>(null);

  const destroyPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setRemoteStream(null);
  }, []);

  useEffect(() => {
    if (!localStream || !socket || !partnerId) return;

    let peer: SimplePeerType.Instance;
    let mounted = true;

    (async () => {
      const SimplePeer = (await import("simple-peer")).default;

      // Fetch ICE servers
      let iceServers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];

      try {
        const res = await fetch(`${SOCKET_URL}/api/ice-servers`);
        const data = await res.json();
        if (data.iceServers) iceServers = data.iceServers;
      } catch {
        // Fall back to default STUN
      }

      if (!mounted) return;

      peer = new SimplePeer({
        initiator: isInitiator,
        stream: localStream,
        trickle: true,
        config: { iceServers },
      });

      peerRef.current = peer;

      peer.on("signal", (data) => {
        socket.emit("webrtc_signal", { target: partnerId, signal: data });
      });

      peer.on("stream", (stream) => {
        if (mounted) setRemoteStream(stream);
      });

      peer.on("close", () => {
        if (mounted) setRemoteStream(null);
      });

      peer.on("error", (err) => {
        console.error("[peer] Error:", err.message);
        if (mounted) setRemoteStream(null);
      });

      // Listen for incoming signals from partner
      const handleSignal = ({ signal }: { signal: unknown }) => {
        if (peer && !peer.destroyed) {
          peer.signal(signal as SimplePeerType.SignalData);
        }
      };
      socket.on("webrtc_signal", handleSignal);

      // Cleanup listener on effect teardown
      return () => {
        socket.off("webrtc_signal", handleSignal);
      };
    })();

    return () => {
      mounted = false;
      destroyPeer();
    };
  }, [localStream, socket, isInitiator, partnerId, destroyPeer]);

  return { remoteStream, destroyPeer };
}
