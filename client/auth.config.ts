import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
    error: "/",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: false, // Allow JS access for Socket.io auth (token is JWE-encrypted)
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    signIn({ profile }) {
      const domain = process.env.ALLOWED_EMAIL_DOMAIN || "krea.ac.in";
      if (!profile?.email?.endsWith(`@${domain}`)) {
        return `/? reason=unauthorized`;
      }
      return true;
    },
    jwt({ token, profile }) {
      if (profile) {
        token.email = profile.email;
        token.name = profile.name;
        token.picture = profile.picture;
      }
      return token;
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email as string;
      if (token.name) session.user.name = token.name as string;
      if (token.picture) session.user.image = token.picture as string;
      return session;
    },
  },
};
