import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { config } from "./server/config.js";
import { authMiddleware } from "./server/middleware/auth.js";
import { timeGateMiddleware } from "./server/middleware/time-gate.js";
import { registerConnectionHandler } from "./server/handlers/connection.js";
import { setupTimeGateCron } from "./server/services/time-gate.js";
import { roomService } from "./server/services/room.js";
import { queueService } from "./server/services/queue.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./shared/socket-events.js";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000");

// Kill switch — when true, all users are disconnected and new connections are rejected
let appKilled = false;

const app = next({ dev });
const nextHandler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer();

  // Socket.IO — attach BEFORE adding request listeners
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    transports: ["websocket", "polling"],
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Socket.IO middleware
  io.use(authMiddleware);
  io.use((socket, next) => {
    if (appKilled) return next(new Error("App is currently turned off. Try again later."));
    next();
  });
  io.use(timeGateMiddleware);

  // Connection handler
  registerConnectionHandler(io);

  // Start 2 AM cron disconnect
  setupTimeGateCron(io);

  // HTTP request handler
  httpServer.on("request", (req, res) => {
    const pathname = req.url || "/";

    // Skip Socket.IO requests — already handled by Engine.IO listener
    if (pathname.startsWith("/socket.io")) return;

    // Public time gate status (for waiting page)
    if (pathname === "/api/time-gate") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        startHour: config.TIME_GATE_START_HOUR,
        endHour: config.TIME_GATE_END_HOUR,
        timezone: config.TIME_GATE_TIMEZONE,
        appKilled,
        waitingCount: io.sockets.sockets.size,
      }));
      return;
    }

    // Health check
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", time: new Date().toISOString() }));
      return;
    }

    // ICE servers endpoint
    if (pathname === "/api/ice-servers") {
      const iceServers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];

      if (config.TURN_URLS && config.TURN_USERNAME && config.TURN_CREDENTIAL) {
        const turnUrls = config.TURN_URLS.split(",").map((u: string) => u.trim());
        iceServers.push({
          urls: turnUrls,
          username: config.TURN_USERNAME,
          credential: config.TURN_CREDENTIAL,
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ iceServers }));
      return;
    }

    // Admin stats endpoint
    if (pathname === "/api/admin/stats") {
      const sockets = Array.from(io.sockets.sockets.values());
      const genderCounts = { male: 0, female: 0, other: 0, unset: 0 };
      const schoolCounts: Record<string, number> = {};

      for (const s of sockets) {
        const g = s.data.gender;
        if (g === "male" || g === "female" || g === "other") {
          genderCounts[g]++;
        } else {
          genderCounts.unset++;
        }
        const school = s.data.school || "KREA";
        schoolCounts[school] = (schoolCounts[school] || 0) + 1;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        online: sockets.length,
        inQueue: queueService.getSize(),
        inRooms: roomService.getRoomCount() * 2,
        rooms: roomService.getRoomCount(),
        gender: genderCounts,
        schools: schoolCounts,
        appKilled,
        timeGate: {
          startHour: config.TIME_GATE_START_HOUR,
          endHour: config.TIME_GATE_END_HOUR,
          timezone: config.TIME_GATE_TIMEZONE,
        },
      }));
      return;
    }

    // Admin users list (with optional gender filter)
    if (pathname.startsWith("/api/admin/users")) {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      const genderFilter = url.searchParams.get("gender");
      const sockets = Array.from(io.sockets.sockets.values());

      const users = sockets
        .filter((s) => !genderFilter || s.data.gender === genderFilter)
        .map((s) => {
          const room = roomService.getRoomBySocket(s.id);
          let status = "idle";
          if (room) {
            const partnerId = room.socket1Id === s.id ? room.socket2Id : room.socket1Id;
            const partnerSocket = io.sockets.sockets.get(partnerId);
            status = "chatting with " + (partnerSocket?.data.name || "unknown");
          } else if (queueService.isInQueue(s.id)) {
            status = "in queue";
          }
          return {
            name: s.data.name,
            email: s.data.email,
            gender: s.data.gender || "unset",
            school: s.data.school || "KREA",
            status,
          };
        });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ users }));
      return;
    }

    // Admin force match two users by email
    if (pathname === "/api/admin/force-match" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { email1, email2 } = JSON.parse(body);
          if (!email1 || !email2) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Both emails are required" }));
            return;
          }

          // Find sockets by email
          const allSockets = Array.from(io.sockets.sockets.values());
          const sock1 = allSockets.find((s) => s.data.email === email1);
          const sock2 = allSockets.find((s) => s.data.email === email2);

          if (!sock1 || !sock2) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              error: `User not found: ${!sock1 ? email1 : ""}${!sock1 && !sock2 ? ", " : ""}${!sock2 ? email2 : ""}`,
            }));
            return;
          }

          // Disconnect both from current rooms if any
          const existingRoom1 = roomService.getRoomBySocket(sock1.id);
          if (existingRoom1) {
            const partner1 = existingRoom1.socket1Id === sock1.id ? existingRoom1.socket2Id : existingRoom1.socket1Id;
            io.to(partner1).emit("partner_disconnected");
            sock1.leave(existingRoom1.id);
            const p1Sock = io.sockets.sockets.get(partner1);
            p1Sock?.leave(existingRoom1.id);
            roomService.destroyRoom(existingRoom1.id);
          }

          const existingRoom2 = roomService.getRoomBySocket(sock2.id);
          if (existingRoom2) {
            const partner2 = existingRoom2.socket1Id === sock2.id ? existingRoom2.socket2Id : existingRoom2.socket1Id;
            io.to(partner2).emit("partner_disconnected");
            sock2.leave(existingRoom2.id);
            const p2Sock = io.sockets.sockets.get(partner2);
            p2Sock?.leave(existingRoom2.id);
            roomService.destroyRoom(existingRoom2.id);
          }

          // Remove both from queue
          queueService.removeFromQueue(sock1.id);
          queueService.removeFromQueue(sock2.id);

          // Create new room
          const room = roomService.createRoom(sock1.id, sock2.id, sock1.data.email, sock2.data.email);
          sock1.join(room.id);
          sock2.join(room.id);

          sock1.emit("match_found", {
            roomId: room.id,
            partnerId: sock2.id,
            partnerName: sock2.data.name,
            partnerSchool: sock2.data.school,
            isInitiator: true,
          });

          sock2.emit("match_found", {
            roomId: room.id,
            partnerId: sock1.id,
            partnerName: sock1.data.name,
            partnerSchool: sock1.data.school,
            isInitiator: false,
          });

          console.log(`[admin] Force matched ${sock1.data.name} <-> ${sock2.data.name}`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, room: room.id }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Admin update time gate
    if (pathname === "/api/admin/time-gate" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { startHour, endHour } = JSON.parse(body);
          if (typeof startHour === "number" && typeof endHour === "number" &&
              startHour >= 0 && startHour <= 24 && endHour >= 0 && endHour <= 24) {
            process.env.TIME_GATE_START_HOUR = String(startHour);
            process.env.TIME_GATE_END_HOUR = String(endHour);
            console.log(`[admin] Time gate updated: ${startHour}:00 – ${endHour}:00`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, startHour, endHour }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid hours (0-24)" }));
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Admin kill switch toggle
    if (pathname === "/api/admin/kill-switch" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { killed } = JSON.parse(body);
          appKilled = !!killed;
          console.log(`[admin] App ${appKilled ? "TURNED OFF" : "TURNED ON"}`);

          if (appKilled) {
            // Disconnect all users
            for (const [, s] of io.sockets.sockets) {
              s.emit("force_disconnect", { reason: "App has been turned off by admin." });
              s.disconnect(true);
            }
            roomService.destroyAll();
            queueService.clear();
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, appKilled }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Everything else -> Next.js
    const parsedUrl = parse(req.url || "/", true);
    nextHandler(req, res, parsedUrl);
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[server] Running on port ${port} (${dev ? "dev" : "production"})`);
    console.log(
      `[server] Time gate: ${config.TIME_GATE_START_HOUR}:00 – ${config.TIME_GATE_END_HOUR}:00 (${config.TIME_GATE_TIMEZONE})`
    );
  });
});
