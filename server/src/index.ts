import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { timeGateMiddleware } from "./middleware/time-gate.js";
import { registerConnectionHandler } from "./handlers/connection.js";
import { setupTimeGateCron } from "./services/time-gate.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../../shared/socket-events";

const app = express();
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ICE server endpoint — returns STUN + TURN servers
app.get("/api/ice-servers", async (_req, res) => {
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Option 1: Metered TURN API (free tier — sign up at metered.ca)
  if (config.METERED_API_KEY) {
    try {
      const resp = await fetch(
        `https://krea.metered.live/api/v1/turn/credentials?apiKey=${config.METERED_API_KEY}`
      );
      const turnServers = await resp.json();
      if (Array.isArray(turnServers)) {
        iceServers.push(...turnServers);
      }
    } catch (err) {
      console.error("[ice] Failed to fetch Metered TURN credentials:", err);
    }
  }

  // Option 2: Manual TURN credentials from env vars
  if (config.TURN_URLS && config.TURN_USERNAME && config.TURN_CREDENTIAL) {
    const turnUrls = config.TURN_URLS.split(",").map((u: string) => u.trim());
    iceServers.push({
      urls: turnUrls,
      username: config.TURN_USERNAME,
      credential: config.TURN_CREDENTIAL,
    });
  }

  res.json({ iceServers });
});

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: config.CORS_ORIGIN,
    credentials: true,
  },
});

// Socket.io middleware
io.use(authMiddleware);
io.use(timeGateMiddleware);

// Connection handler
registerConnectionHandler(io);

// Start 2 AM cron disconnect
setupTimeGateCron(io);

httpServer.listen(config.PORT, () => {
  console.log(`[server] Socket.io server running on port ${config.PORT}`);
  console.log(`[server] CORS origin: ${config.CORS_ORIGIN}`);
  console.log(
    `[server] Time gate: ${config.TIME_GATE_START_HOUR}:00 – ${config.TIME_GATE_END_HOUR}:00 (${config.TIME_GATE_TIMEZONE})`
  );
});
