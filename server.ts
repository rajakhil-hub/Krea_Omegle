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
    transports: ["polling", "websocket"],
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

  // HTTP request handler — runs AFTER Socket.IO intercepts /socket.io/ requests
  httpServer.on("request", (req, res) => {
    const pathname = req.url || "/";

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

      const respond = () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ iceServers }));
      };

      if (config.METERED_API_KEY) {
        const appName = config.METERED_APP_NAME || "krea";
        fetch(
          `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${config.METERED_API_KEY}`
        )
          .then((r) => r.json())
          .then((turnServers) => {
            if (Array.isArray(turnServers)) iceServers.push(...turnServers);
          })
          .catch((err) =>
            console.error("[ice] Failed to fetch Metered TURN credentials:", err)
          )
          .finally(respond);
        return;
      }

      if (config.TURN_URLS && config.TURN_USERNAME && config.TURN_CREDENTIAL) {
        const turnUrls = config.TURN_URLS.split(",").map((u: string) => u.trim());
        iceServers.push({
          urls: turnUrls,
          username: config.TURN_USERNAME,
          credential: config.TURN_CREDENTIAL,
        });
      }

      respond();
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
