import { NextResponse } from "next/server";
import { Client } from "@gradio/client";
import type { ModelOption } from "@/lib/spectre";
import { DEFAULT_MODEL } from "@/lib/spectre";

// Same runtime constraints as /api/trace — the Gradio client needs Node APIs.
export const runtime = "nodejs";

const SPACE_ID =
  process.env.SPECTRE_SPACE_ID ?? "james-ra-henry/spectre-cia-zerogpu-test";

// The model list only changes when we edit AVAILABLE_MODELS in app.py —
// cache briefly in-memory so every page load doesn't round-trip to the
// Space. Resets on cold start / per instance, same tradeoff as the rate
// limiter in /api/trace.
const CACHE_MS = 5 * 60_000;
let cached: { models: ModelOption[]; at: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.models);
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    // No hard failure here — the selector just falls back to the one
    // default model, same as before multi-model support existed.
    return NextResponse.json([DEFAULT_MODEL]);
  }

  try {
    const client = await Client.connect(SPACE_ID, {
      token: token as `hf_${string}`,
    });
    const result = await client.predict("/list_models", []);
    const models = (result.data as unknown[])[0] as ModelOption[];
    if (!Array.isArray(models) || models.length === 0) {
      return NextResponse.json([DEFAULT_MODEL]);
    }
    cached = { models, at: Date.now() };
    return NextResponse.json(models);
  } catch {
    // Space waking up / unreachable — degrade to the default rather than
    // breaking the page.
    return NextResponse.json([DEFAULT_MODEL]);
  }
}
