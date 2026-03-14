import type { Server, Socket } from "socket.io";
import { queueService } from "../services/queue.js";
import { roomService } from "../services/room.js";
import { registerMatchmakingHandlers } from "./matchmaking.js";
import { registerSignalingHandlers } from "./signaling.js";
import { registerChatHandlers } from "./chat.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../../shared/socket-events";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const DISCONNECT_GRACE_MS = 15_000; // 15 seconds to reconnect

export function registerConnectionHandler(io: IOServer): void {
  io.on("connection", (socket: IOSocket) => {
    console.log(`[connect] ${socket.data.name} (${socket.data.email}) — ${socket.id}`);

    // Check if this user has an existing room (reconnection scenario)
    const existingRoom = roomService.rejoinRoom(socket.data.email, socket.id);
    if (existingRoom) {
      // Rejoin the Socket.IO room
      socket.join(existingRoom.id);

      // Notify the partner with updated socket info
      const partnerId = existingRoom.socket1Id === socket.id
        ? existingRoom.socket2Id
        : existingRoom.socket1Id;

      // Send match_found to reconnected user so their client updates the partner ID
      const partnerSocket = io.sockets.sockets.get(partnerId);
      const partnerName = partnerSocket?.data.name || "Partner";
      const isInitiator = existingRoom.socket1Id === socket.id;

      socket.emit("match_found", {
        roomId: existingRoom.id,
        partnerId,
        partnerName,
        partnerSchool: partnerSocket?.data.school || "KREA",
        isInitiator,
      });

      // Also update the partner with the new socket ID
      io.to(partnerId).emit("match_found", {
        roomId: existingRoom.id,
        partnerId: socket.id,
        partnerName: socket.data.name,
        partnerSchool: socket.data.school,
        isInitiator: !isInitiator,
      });

      console.log(`[connect] ${socket.data.name} rejoined room ${existingRoom.id}`);
    }

    // Register all event handlers
    registerMatchmakingHandlers(io, socket);
    registerSignalingHandlers(io, socket);
    registerChatHandlers(io, socket);

    // Handle disconnect — use grace period to allow reconnection
    socket.on("disconnect", (reason) => {
      console.log(`[disconnect] ${socket.data.name} — ${reason}`);

      // Remove from queue if waiting
      queueService.removeFromQueue(socket.id);

      // Check if in a room
      const room = roomService.getRoomBySocket(socket.id);
      if (room) {
        const partnerId = room.socket1Id === socket.id ? room.socket2Id : room.socket1Id;

        // Schedule room destruction with grace period
        roomService.scheduleDestroy(socket.id, DISCONNECT_GRACE_MS, () => {
          // After grace period, notify partner and clean up
          io.to(partnerId).emit("partner_disconnected");
          console.log(`[disconnect] ${socket.data.name} did not reconnect — partner notified`);
        });

        console.log(`[disconnect] ${socket.data.name} — waiting ${DISCONNECT_GRACE_MS / 1000}s for reconnect`);
      }
    });
  });
}
