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
} from "./shared/socket-events";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000");

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
        timeGate: {
          startHour: config.TIME_GATE_START_HOUR,
          endHour: config.TIME_GATE_END_HOUR,
          timezone: config.TIME_GATE_TIMEZONE,
        },
      }));
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

    // Debug endpoint
    if (pathname === "/debug") {
      const sockets = Array.from(io.sockets.sockets.entries()).map(([id, s]) => ({
        id,
        name: s.data.name,
        rooms: Array.from(s.rooms),
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          connectedSockets: sockets.length,
          sockets,
          rooms: roomService.getAllRooms().map((r) => ({
            id: r.id,
            socket1Id: r.socket1Id,
            socket2Id: r.socket2Id,
          })),
          queueSize: queueService.getSize(),
        })
      );
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
