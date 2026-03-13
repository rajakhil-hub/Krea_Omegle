import { decode } from "@auth/core/jwt";
import { config } from "../config.js";
import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../../../shared/socket-events";

type SocketMiddleware = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  next: (err?: Error) => void
) => void;

export const authMiddleware: SocketMiddleware = async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("No authentication token provided"));
  }

  try {
    // Try production salt first, then development salt
    let decoded = await decode({
      token,
      secret: config.NEXTAUTH_SECRET,
      salt: "__Secure-authjs.session-token",
    }).catch(() => null);

    if (!decoded) {
      decoded = await decode({
        token,
        secret: config.NEXTAUTH_SECRET,
        salt: "authjs.session-token",
      });
    }

    if (!decoded?.email) {
      return next(new Error("Invalid token: no email found"));
    }

    // Verify domain
    if (!decoded.email.endsWith(`@${config.ALLOWED_EMAIL_DOMAIN}`)) {
      return next(new Error("Unauthorized email domain"));
    }

    socket.data.email = decoded.email;
    socket.data.name = (decoded.name as string) || decoded.email.split("@")[0];
    next();
  } catch (err) {
    console.error("[auth] Token decode failed:", err);
    next(new Error("Authentication failed"));
  }
};
