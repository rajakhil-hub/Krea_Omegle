import { auth } from "./auth";
import { NextResponse } from "next/server";

const ADMIN_EMAIL = "akhil_raj.sias24@krea.ac.in";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith("/lobby") || pathname.startsWith("/chat") || pathname.startsWith("/gender");

  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname.startsWith("/admin")) {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (req.auth.user?.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL("/lobby", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/lobby/:path*", "/chat/:path*", "/gender/:path*", "/admin/:path*"],
};
