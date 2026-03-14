/** Payload for a matched pair */
export interface MatchFoundPayload {
  roomId: string;
  partnerId: string;
  partnerName: string;
  partnerSchool: string;
  isInitiator: boolean;
}

/** Text message payload */
export interface ChatMessage {
  message: string;
  timestamp: number;
  sender: "you" | "partner";
}

/** WebRTC signaling payload */
export interface SignalPayload {
  signal: unknown;
  target: string;
}

/** Events emitted from the client to the server */
export interface ClientToServerEvents {
  join_queue: () => void;
  leave_queue: () => void;
  skip: () => void;
  send_message: (message: string) => void;
  webrtc_signal: (data: { target: string; signal: unknown }) => void;
}

/** Events emitted from the server to the client */
export interface ServerToClientEvents {
  match_found: (data: MatchFoundPayload) => void;
  partner_disconnected: () => void;
  receive_message: (data: ChatMessage) => void;
  webrtc_signal: (data: { signal: unknown }) => void;
  queue_joined: () => void;
  force_disconnect: (data: { reason: string }) => void;
  time_gate_status: (data: { isOpen: boolean; remainingSeconds: number }) => void;
  error: (data: { message: string }) => void;
}

/** Inter-server events (unused in MVP) */
export interface InterServerEvents {}

/** Data attached to each socket after auth */
export interface SocketData {
  email: string;
  name: string;
  school: string;
}
