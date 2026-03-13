// Lazy config — env vars are read on first access, after Next.js loads .env.local
function env(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export const config = {
  get NEXTAUTH_SECRET() {
    const v = process.env.NEXTAUTH_SECRET;
    if (!v) throw new Error("Missing required env var: NEXTAUTH_SECRET");
    return v;
  },
  get ALLOWED_EMAIL_DOMAIN() { return env("ALLOWED_EMAIL_DOMAIN", "krea.ac.in"); },
  get TIME_GATE_START_HOUR() { return parseInt(env("TIME_GATE_START_HOUR", "23")); },
  get TIME_GATE_END_HOUR() { return parseInt(env("TIME_GATE_END_HOUR", "2")); },
  get TIME_GATE_TIMEZONE() { return env("TIME_GATE_TIMEZONE", "Asia/Kolkata"); },
  get METERED_API_KEY() { return env("METERED_API_KEY"); },
  get METERED_APP_NAME() { return env("METERED_APP_NAME"); },
  get TURN_URLS() { return env("TURN_URLS"); },
  get TURN_USERNAME() { return env("TURN_USERNAME"); },
  get TURN_CREDENTIAL() { return env("TURN_CREDENTIAL"); },
};
