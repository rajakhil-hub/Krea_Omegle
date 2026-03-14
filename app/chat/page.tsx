"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { VideoGrid } from "@/components/video-grid";
import { TextChat } from "@/components/text-chat";
import { ChatControls } from "@/components/chat-controls";
import { useSocket } from "@/hooks/use-socket";
import { useMediaStream } from "@/hooks/use-media-stream";
import { usePeer } from "@/hooks/use-peer";
import type { MatchFoundPayload, ChatMessage } from "@/types";

function ChatContent() {
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  const [matchData, setMatchData] = useState<MatchFoundPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerLeft, setPartnerLeft] = useState(false);

  const {
    localStream,
    error: mediaError,
    isAudioEnabled,
    isVideoEnabled,
    requestPermission,
    toggleAudio,
    toggleVideo,
    stopStream,
  } = useMediaStream();

  const { remoteStream, destroyPeer } = usePeer({
    localStream,
    socket,
    isInitiator: matchData?.isInitiator ?? false,
    partnerId: matchData?.partnerId ?? "",
  });

  // Load match data and request camera on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("match");
    if (!stored) {
      router.push("/lobby");
      return;
    }
    const data = JSON.parse(stored);
    console.log("[chat] Match data loaded:", data.partnerId, "initiator:", data.isInitiator, "socket:", socket?.id);
    setMatchData(data);
    requestPermission();
  }, [router, requestPermission, socket]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: ChatMessage) => {
      console.log("[chat] Received message:", data.message.slice(0, 30));
      setMessages((prev) => [...prev, data]);
    };

    const handlePartnerDisconnected = () => {
      setPartnerLeft(true);
      destroyPeer();
    };

    const handleForceDisconnect = (data: { reason: string }) => {
      alert(data.reason);
      stopStream();
      router.push("/");
    };

    socket.on("receive_message", handleMessage);
    socket.on("partner_disconnected", handlePartnerDisconnected);
    socket.on("force_disconnect", handleForceDisconnect);

    // Listen for new match (after skip)
    socket.on("match_found", (data: MatchFoundPayload) => {
      setMatchData(data);
      setMessages([]);
      setPartnerLeft(false);
      sessionStorage.setItem("match", JSON.stringify(data));
    });

    return () => {
      socket.off("receive_message", handleMessage);
      socket.off("partner_disconnected", handlePartnerDisconnected);
      socket.off("force_disconnect", handleForceDisconnect);
      socket.off("match_found");
    };
  }, [socket, router, destroyPeer, stopStream]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!socket) return;
      console.log("[chat] Sending message, socket:", socket.id, "connected:", socket.connected);
      socket.emit("send_message", message);
      setMessages((prev) => [
        ...prev,
        { message, timestamp: Date.now(), sender: "you" },
      ]);
    },
    [socket]
  );

  const handleSkip = () => {
    if (!socket) return;
    destroyPeer();
    setMessages([]);
    setPartnerLeft(false);
    socket.emit("skip");
  };

  const handleStop = () => {
    if (socket) {
      socket.emit("leave_queue");
    }
    destroyPeer();
    stopStream();
    sessionStorage.removeItem("match");
    router.push("/lobby");
  };

  return (
    <div className="flex flex-1 flex-col md:flex-row gap-3 p-3 overflow-hidden">
      {/* Left side: Video + Controls */}
      <div className="flex flex-col md:w-3/5 gap-3">
        {mediaError && (
          <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-3 py-2 text-sm text-yellow-200">
            Camera/mic unavailable: {mediaError}. Text chat still works!
          </div>
        )}
        <VideoGrid localStream={localStream} remoteStream={remoteStream} />
        <ChatControls
          onSkip={handleSkip}
          onStop={handleStop}
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
        />
        {matchData && (
          <p className="text-center text-sm text-[var(--muted)]">
            Chatting with <span className="text-purple-400">{matchData.partnerName}</span>
            <span className="ml-2 rounded bg-purple-600/20 px-2 py-0.5 text-xs text-purple-300">{matchData.partnerSchool}</span>
          </p>
        )}
      </div>

      {/* Right side: Text Chat */}
      <div className="flex flex-col md:w-2/5 min-h-[300px] md:min-h-0">
        {partnerLeft ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--card)]">
            <div className="text-center space-y-4">
              <p className="text-lg text-[var(--muted)]">Partner left the chat</p>
              <button
                onClick={handleSkip}
                className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
              >
                Find New Match
              </button>
            </div>
          </div>
        ) : (
          <TextChat messages={messages} onSend={sendMessage} />
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (

      <div className="flex min-h-screen flex-col">
        <Navbar />
        <ChatContent />
      </div>

  );
}
