import type { Server, Socket } from "socket.io";
import { roomService } from "../services/room.js";
import { MAX_MESSAGE_LENGTH } from "../../../shared/constants";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../../../shared/socket-events";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerChatHandlers(io: IOServer, socket: IOSocket): void {
  socket.on("send_message", (message: string) => {
    // Validate
    if (!message || typeof message !== "string") return;
    const trimmed = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) return;

    // Find partner
    const partner = roomService.getPartner(socket.id);
    if (!partner) {
      console.log(`[chat] ${socket.data.name} sent message but has no partner`);
      socket.emit("error", { message: "Not in a chat room" });
      return;
    }

    console.log(`[chat] ${socket.data.name} -> partner ${partner}: "${trimmed.slice(0, 30)}..."`);

    // Relay to partner using io.to() for direct delivery
    io.to(partner).emit("receive_message", {
      message: trimmed,
      timestamp: Date.now(),
      sender: "partner",
    });
  });
}
