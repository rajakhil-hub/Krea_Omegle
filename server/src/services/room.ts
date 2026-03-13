import { randomUUID } from "crypto";
import { ROOM_PREFIX } from "../../../shared/constants";

export interface Room {
  id: string;
  socket1Id: string;
  socket2Id: string;
  createdAt: Date;
}

class RoomService {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();

  createRoom(socket1Id: string, socket2Id: string): Room {
    const id = `${ROOM_PREFIX}${randomUUID().slice(0, 8)}`;
    const room: Room = { id, socket1Id, socket2Id, createdAt: new Date() };

    this.rooms.set(id, room);
    this.socketToRoom.set(socket1Id, id);
    this.socketToRoom.set(socket2Id, id);

    return room;
  }

  getPartner(socketId: string): string | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    return room.socket1Id === socketId ? room.socket2Id : room.socket1Id;
  }

  getRoomBySocket(socketId: string): Room | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  destroyRoom(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    this.socketToRoom.delete(room.socket1Id);
    this.socketToRoom.delete(room.socket2Id);
    this.rooms.delete(roomId);

    return room;
  }

  destroyBySocket(socketId: string): Room | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.destroyRoom(roomId);
  }

  destroyAll(): void {
    this.rooms.clear();
    this.socketToRoom.clear();
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
}

export const roomService = new RoomService();
