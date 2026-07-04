import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";
import type { TraceReport } from "@/lib/spectre";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// The Gradio client needs Node APIs (not the Edge runtime). ZeroGPU cold
// starts can be slow, so ask for a long execution window — note this is
// capped by your Vercel plan (Hobby ~60s, Pro up to 300s). Locally it's
// effectively unbounded.
export const runtime = "nodejs";
export const maxDuration = 300;

const SPACE_ID =
  process.env.SPECTRE_SPACE_ID ?? "james-ra-henry/spectre-cia-zerogpu-test";
const MAX_CHARS = 8000;

// Best-effort in-memory per-IP throttle. Resets on cold start / per instance —
// adequate as a GPU-spend guard for the demo; swap for a durable store
// (Upstash/KV) before serious public traffic.
const RATE_LIMIT = 12;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Server is not configured (missing HF_TOKEN).", stage: "config" },
      { status: 500 },
    );
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment.", stage: "rate_limit" },
      { status: 429 },
    );
  }

  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body.", stage: "bad_request" },
      { status: 400 },
    );
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Provide a non-empty `text` string.", stage: "bad_request" },
      { status: 400 },
    );
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Input too long (max ${MAX_CHARS} characters).`, stage: "bad_request" },
      { status: 413 },
    );
  }

  try {
    const client = await Client.connect(SPACE_ID, {
      token: token as `hf_${string}`,
    });
    const result = await client.predict("/run_trace", [text]);
    // The Gradio handler returns 10 positional outputs; the last one
    // (full_output) is json.dumps(report) — the full structured report.
    const outputs = result.data as unknown[];
    const raw = outputs[outputs.length - 1];
    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json(
        { error: "Empty response from the trace pipeline.", stage: "upstream" },
        { status: 502 },
      );
    }
    const report = JSON.parse(raw) as TraceReport;
    // Attribution logging: who ran what (email from the signed session).
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    console.log(
      `[trace] email=${session?.email ?? "unknown"} chars=${text.length} verdict=${report.verdict} tier=${report.signal?.tier}`,
    );
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Surface a coarse stage so the UI can distinguish "space waking up" from
    // a real failure without leaking internals.
    const waking = /queue|starting|building|503|502|timeout/i.test(message);
    return NextResponse.json(
      {
        error: waking
          ? "The inference Space is waking up (ZeroGPU cold start). Try again in a moment."
          : "Trace failed upstream.",
        stage: waking ? "cold_start" : "upstream",
      },
      { status: waking ? 503 : 502 },
    );
  }
}
