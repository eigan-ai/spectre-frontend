/**
 * Best-effort Mattermost notifications via an incoming webhook.
 *
 * Set `MATTERMOST_WEBHOOK_URL` (server-only) to enable. If unset, every call
 * here is a no-op — the app works identically without it. Failures are
 * swallowed and logged; they must never break a login or a trace.
 *
 * Call these from `after()` in a route handler so they run *after* the response
 * is sent and add zero latency to the user's request.
 */

interface MMField {
  short: boolean;
  title: string;
  value: string;
}

interface MMAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: MMField[];
}

interface MMPayload {
  text?: string;
  channel?: string;
  attachments?: MMAttachment[];
}

const TIER_COLOR: Record<string, string> = {
  enforced: "#d4183d",
  observed: "#e8a33d",
  clean: "#3a8f3a",
};

export function mattermostEnabled(): boolean {
  return !!process.env.MATTERMOST_WEBHOOK_URL;
}

async function post(payload: MMPayload): Promise<void> {
  const url = process.env.MATTERMOST_WEBHOOK_URL;
  if (!url) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Spectre",
        icon_emoji: ":satellite:",
        // Optional override; the webhook already has a default channel.
        channel: process.env.MATTERMOST_CHANNEL || undefined,
        ...payload,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("[mattermost] post failed:", err);
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyLogin(email: string, ip: string): Promise<void> {
  await post({
    attachments: [
      {
        color: "#2855a0", // Signal Blue
        title: "🔑 New access",
        fields: [
          { short: true, title: "Email", value: email },
          { short: true, title: "IP", value: ip },
        ],
      },
    ],
  });
}

export async function notifyTrace(opts: {
  email: string;
  text: string;
  verdict: string;
  tier: string;
  traceMs?: number;
}): Promise<void> {
  const preview =
    opts.text.length > 500 ? `${opts.text.slice(0, 500)}…` : opts.text;
  await post({
    attachments: [
      {
        color: TIER_COLOR[opts.tier] ?? "#6b7280",
        title: `🔍 Trace · ${opts.tier?.toUpperCase()} · ${opts.verdict}`,
        fields: [
          { short: true, title: "Email", value: opts.email },
          {
            short: true,
            title: "Trace time",
            value:
              typeof opts.traceMs === "number"
                ? `${opts.traceMs.toFixed(0)} ms`
                : "—",
          },
          // Prompt content. Drop this field for metadata-only logging.
          { short: false, title: "Prompt", value: "```\n" + preview + "\n```" },
        ],
      },
    ],
  });
}
