/**
 * Access gate for the Spectre demo.
 *
 * The frontend is public, so a lightweight login blocks casual access and
 * lets us attribute usage to an email. Passwords are checked SERVER-SIDE only
 * (never shipped to the browser); the session is an HMAC-signed cookie so it
 * can't be forged by editing a cookie value.
 *
 * Uses Web Crypto (`crypto.subtle`) so this module works in BOTH the Node.js
 * route handlers and the Edge middleware. Do not import it from Client
 * Components — it reads server-only secrets.
 */

export const SESSION_COOKIE = "spectre_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

const enc = new TextEncoder();

export interface Session {
  email: string;
  iat: number; // issued-at, ms epoch
}

/** Comma-delimited allowed passwords, e.g. Vercel env `ACCESS_PASSWORDS`. */
export function allowedPasswords(): string[] {
  return (process.env.ACCESS_PASSWORDS || "internal_admin")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function isPasswordAllowed(password: string): boolean {
  const allowed = allowedPasswords();
  // Length-independent membership check; the security here is the secret
  // itself, and this is a low-value internal gate, so a plain compare is fine.
  return allowed.includes(password);
}

function secret(): string {
  // In production AUTH_SECRET must be set (see README). The dev fallback keeps
  // local runs working but is intentionally not secret.
  return process.env.AUTH_SECRET || "dev-insecure-auth-secret-set-AUTH_SECRET";
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Create a signed session token: `<payload>.<hmac>` (both base64url). */
export async function createSessionToken(email: string): Promise<string> {
  const payload: Session = { email, iat: Date.now() };
  const p = b64urlFromBytes(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(p)));
  return `${p}.${b64urlFromBytes(sig)}`;
}

/** Verify a session token; returns the Session or null if invalid/expired. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<Session | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const p = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await hmacKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      bytesFromB64url(sig) as BufferSource,
      enc.encode(p),
    );
    if (!ok) return null;
    const data = JSON.parse(
      new TextDecoder().decode(bytesFromB64url(p)),
    ) as Session;
    if (
      !data ||
      typeof data.email !== "string" ||
      typeof data.iat !== "number"
    ) {
      return null;
    }
    if (Date.now() - data.iat > SESSION_MAX_AGE * 1000) return null;
    return data;
  } catch {
    return null;
  }
}
