import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Paths reachable without a session.
const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API = new Set(["/api/login", "/api/logout"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  // Protected API (e.g. /api/trace, which spends GPU) → 401, no redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sign in required.", stage: "auth" },
      { status: 401 },
    );
  }

  // Pages → send to /login, remembering where they were headed.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml)$).*)",
  ],
};
