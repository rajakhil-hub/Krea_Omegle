import type { Server, Socket } from "socket.io";
import { roomService } from "../services/room.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../../../shared/socket-events";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerSignalingHandlers(io: IOServer, socket: IOSocket): void {
  socket.on("webrtc_signal", ({ target, signal }) => {
    // Verify the target is actually the partner
    const partner = roomService.getPartner(socket.id);
    if (!partner || partner !== target) {
      console.log(`[signal] ${socket.data.name} invalid target: ${target}, partner: ${partner}`);
      socket.emit("error", { message: "Invalid signaling target" });
      return;
    }

    // Relay signal to partner using io.to() for direct delivery
    io.to(target).emit("webrtc_signal", { signal });
  });
}
