import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";
import { DEFAULT_MODEL } from "@/lib/spectre";

// Same runtime constraints as /api/trace: needs Node APIs, and a warm load of
// a cold 14B model can take a while on ZeroGPU.
export const runtime = "nodejs";
export const maxDuration = 300;

const SPACE_ID =
  process.env.SPECTRE_SPACE_ID ?? "james-ra-henry/spectre-cia-zerogpu-test";

// Warming loads a model on the GPU — same ZeroGPU quota cost as a trace — so
// guard it per-IP against rapid model-switch spam. Resets on cold start.
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
      { error: "Too many model switches. Please wait a moment.", stage: "rate_limit" },
      { status: 429 },
    );
  }

  let modelId: unknown;
  try {
    ({ model_id: modelId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", stage: "bad_request" }, { status: 400 });
  }
  const resolvedModelId =
    typeof modelId === "string" && modelId ? modelId : DEFAULT_MODEL.id;

  try {
    const client = await Client.connect(SPACE_ID, { token: token as `hf_${string}` });
    const result = await client.predict("/warm_model", [resolvedModelId]);
    const out = (result.data as unknown[])?.[0] as
      | { loaded?: boolean; model_id?: string }
      | undefined;
    if (!out?.loaded) {
      return NextResponse.json(
        { error: "Model did not load.", stage: "upstream" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { model_id: out.model_id ?? resolvedModelId, loaded: true },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const waking = /queue|starting|building|503|502|timeout/i.test(message);
    return NextResponse.json(
      {
        error: waking
          ? "The inference Space is waking up (ZeroGPU cold start). Try again in a moment."
          : "Model warm-up failed upstream.",
        stage: waking ? "cold_start" : "upstream",
      },
      { status: waking ? 503 : 502 },
    );
  }
}
