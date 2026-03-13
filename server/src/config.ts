import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  PORT: parseInt(process.env.SOCKET_PORT || process.env.PORT || "4000"),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  NEXTAUTH_SECRET: required("NEXTAUTH_SECRET"),
  ALLOWED_EMAIL_DOMAIN: process.env.ALLOWED_EMAIL_DOMAIN || "krea.ac.in",
  TIME_GATE_START_HOUR: parseInt(process.env.TIME_GATE_START_HOUR || "23"),
  TIME_GATE_END_HOUR: parseInt(process.env.TIME_GATE_END_HOUR || "2"),
  TIME_GATE_TIMEZONE: process.env.TIME_GATE_TIMEZONE || "Asia/Kolkata",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  METERED_API_KEY: process.env.METERED_API_KEY || "",
  TURN_URLS: process.env.TURN_URLS || "",
  TURN_USERNAME: process.env.TURN_USERNAME || "",
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || "",
};
