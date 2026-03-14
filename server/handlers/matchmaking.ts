import type { Server, Socket } from "socket.io";
import { queueService } from "../services/queue.js";
import { roomService } from "../services/room.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../../shared/socket-events";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function handleMatch(io: IOServer, match: { socket1Id: string; socket2Id: string }): void {
  const socket1 = io.sockets.sockets.get(match.socket1Id);
  const socket2 = io.sockets.sockets.get(match.socket2Id);

  if (!socket1 || !socket2) {
    // One disconnected before match could be made — put the other back
    if (socket1) queueService.addToQueue(socket1.id);
    if (socket2) queueService.addToQueue(socket2.id);
    return;
  }

  const room = roomService.createRoom(socket1.id, socket2.id, socket1.data.email, socket2.data.email);

  // Join both sockets to the Socket.io room
  socket1.join(room.id);
  socket2.join(room.id);

  // Notify both — socket1 is the initiator for WebRTC
  socket1.emit("match_found", {
    roomId: room.id,
    partnerId: socket2.id,
    partnerName: socket2.data.name,
    partnerSchool: socket2.data.school,
    isInitiator: true,
  });

  socket2.emit("match_found", {
    roomId: room.id,
    partnerId: socket1.id,
    partnerName: socket1.data.name,
    partnerSchool: socket1.data.school,
    isInitiator: false,
  });

  console.log(`[match] ${socket1.data.name} <-> ${socket2.data.name} in ${room.id}`);
}

export function registerMatchmakingHandlers(io: IOServer, socket: IOSocket): void {
  socket.on("join_queue", () => {
    // Ensure not already in a room
    const existingRoom = roomService.getRoomBySocket(socket.id);
    if (existingRoom) {
      socket.emit("error", { message: "Already in a chat room" });
      return;
    }

    console.log(`[queue] ${socket.data.name} joined queue`);
    const match = queueService.addToQueue(socket.id);

    if (match) {
      handleMatch(io, match);
    } else {
      socket.emit("queue_joined");
    }
  });

  socket.on("leave_queue", () => {
    queueService.removeFromQueue(socket.id);
    console.log(`[queue] ${socket.data.name} left queue`);
  });

  socket.on("skip", () => {
    // Destroy current room and notify partner
    const partner = roomService.getPartner(socket.id);
    if (partner) {
      io.to(partner).emit("partner_disconnected");

      const room = roomService.destroyBySocket(socket.id);
      if (room) {
        socket.leave(room.id);
        const partnerSocket = io.sockets.sockets.get(partner);
        partnerSocket?.leave(room.id);
      }
    }

    // Put this user back in the queue
    console.log(`[skip] ${socket.data.name} skipped, re-queuing`);
    const match = queueService.addToQueue(socket.id);
    if (match) {
      handleMatch(io, match);
    } else {
      socket.emit("queue_joined");
    }
  });
}
