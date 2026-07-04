import { NextRequest, NextResponse, after } from "next/server";
import {
  createSessionToken,
  isPasswordAllowed,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";
import { notifyLogin } from "@/lib/mattermost";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Light per-IP throttle to blunt password guessing (best-effort, per instance).
const LIMIT = 10;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";

  if (throttled(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let email: unknown;
  let password: unknown;
  try {
    ({ email, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter the password." }, { status: 400 });
  }

  if (!isPasswordAllowed(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  // Tracking: who accessed the demo (email is unverified, for attribution only).
  console.log(`[access] login email=${normalizedEmail} ip=${ip}`);
  after(() => notifyLogin(normalizedEmail, ip));

  const token = await createSessionToken(normalizedEmail);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
