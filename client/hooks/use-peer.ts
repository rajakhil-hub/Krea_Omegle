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
  const signalBufferRef = useRef<unknown[]>([]);

  const destroyPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    signalBufferRef.current = [];
    setRemoteStream(null);
  }, []);

  // Step 1: Buffer incoming WebRTC signals immediately when socket + partnerId are available
  // This ensures no signals are lost while waiting for localStream/camera permission
  useEffect(() => {
    if (!socket || !partnerId) return;

    const handleSignal = ({ signal }: { signal: unknown }) => {
      const peer = peerRef.current;
      if (peer && !peer.destroyed) {
        // Peer exists — apply signal directly
        peer.signal(signal as SimplePeerType.SignalData);
      } else {
        // Peer not ready yet — buffer the signal
        console.log("[peer] Buffering signal (peer not ready)");
        signalBufferRef.current.push(signal);
      }
    };

    socket.on("webrtc_signal", handleSignal);

    return () => {
      socket.off("webrtc_signal", handleSignal);
    };
  }, [socket, partnerId]);

  // Step 2: Create the peer once localStream is available
  useEffect(() => {
    if (!localStream || !socket || !partnerId) return;

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

      console.log("[peer] Creating peer, initiator:", isInitiator, "partner:", partnerId, "iceServers:", iceServers.length);

      const peer = new SimplePeer({
        initiator: isInitiator,
        stream: localStream,
        trickle: true,
        config: { iceServers },
      });

      peerRef.current = peer;

      peer.on("signal", (data) => {
        console.log("[peer] Sending signal to", partnerId);
        socket.emit("webrtc_signal", { target: partnerId, signal: data });
      });

      peer.on("stream", (stream) => {
        console.log("[peer] Received remote stream");
        if (mounted) setRemoteStream(stream);
      });

      peer.on("close", () => {
        if (mounted) setRemoteStream(null);
      });

      peer.on("error", (err) => {
        console.error("[peer] Error:", err.message);
        if (mounted) setRemoteStream(null);
      });

      // Apply any buffered signals that arrived before peer was ready
      const buffered = signalBufferRef.current;
      if (buffered.length > 0) {
        console.log(`[peer] Applying ${buffered.length} buffered signals`);
        for (const signal of buffered) {
          if (!peer.destroyed) {
            peer.signal(signal as SimplePeerType.SignalData);
          }
        }
        signalBufferRef.current = [];
      }
    })();

    return () => {
      mounted = false;
      destroyPeer();
    };
  }, [localStream, socket, isInitiator, partnerId, destroyPeer]);

  return { remoteStream, destroyPeer };
}
