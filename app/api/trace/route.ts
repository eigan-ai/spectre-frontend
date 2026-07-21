import { NextRequest, NextResponse, after } from "next/server";
import { Client } from "@gradio/client";
import type { TraceReport } from "@/lib/spectre";
import { DEFAULT_MODEL, reportDeficiency } from "@/lib/spectre";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { notifyTrace } from "@/lib/mattermost";

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
  let modelId: unknown;
  try {
    ({ text, model_id: modelId } = await req.json());
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
  // Optional — omitting it (or an older client that predates model
  // selection) falls back to the same default the Space itself defaults to.
  if (modelId !== undefined && typeof modelId !== "string") {
    return NextResponse.json(
      { error: "`model_id` must be a string when provided.", stage: "bad_request" },
      { status: 400 },
    );
  }
  const resolvedModelId = (modelId as string | undefined) ?? DEFAULT_MODEL.id;

  try {
    const client = await Client.connect(SPACE_ID, {
      token: token as `hf_${string}`,
    });
    const result = await client.predict("/run_trace", [text, resolvedModelId]);
    // The Gradio handler returns 9 positional outputs; the last one
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

    // A deliberately-emitted `error` verdict is a real sensor failure — the
    // Space's trace crashed and fenced the result off itself (fail closed,
    // never green). That is NOT a cold-start empty report, so surface the
    // actual detail instead of the generic "model is loading" retry, and
    // never post it to Mattermost. Handled before reportDeficiency because an
    // error report is intentionally empty and would otherwise be misclassified
    // as cold_start.
    if (report.verdict === "error") {
      const detail =
        report.error?.detail ??
        report.evidence?.filter(Boolean).join(" ") ??
        "the trace did not complete";
      console.warn(`[trace] sensor error: ${detail}`);
      return NextResponse.json(
        {
          error: `Sensor error — the prompt was not scored (${detail}).`,
          stage: "sensor_error",
        },
        { status: 502 },
      );
    }

    // The Space can hand back a well-formed report before the model is up —
    // parses fine, says "clean", contains nothing. Refuse to render or alert
    // on it; a sensor reporting an all-clear over no data is worse than a
    // visible error. Treated as a cold start because that's what causes it,
    // and the UI already offers Retry for that stage.
    const deficiency = reportDeficiency(report);
    if (deficiency) {
      console.warn(`[trace] discarded empty report: ${deficiency}`);
      return NextResponse.json(
        {
          error:
            "The Space returned an empty trace — no results to report. This usually means the model is still loading.",
          stage: "cold_start",
        },
        { status: 503 },
      );
    }

    // Attribution: who ran what (email from the signed session).
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    const email = session?.email ?? "unknown";
    console.log(
      `[trace] email=${email} chars=${text.length} model=${report.model_id} verdict=${report.verdict} tier=${report.signal?.tier}`,
    );
    // Emit to Mattermost after the response is sent (no added latency).
    after(() =>
      notifyTrace({
        email,
        text,
        verdict: report.verdict,
        tier: report.signal?.tier ?? "unknown",
        // What actually ran; falls back to what we asked for if the report
        // omits it (older Space builds predate `model_id`).
        model: report.model_id ?? resolvedModelId,
        traceMs: report.trace_time_ms,
      }),
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
