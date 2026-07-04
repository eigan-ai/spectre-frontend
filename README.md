# Spectre CIA — Inference Trace (Frontend)

A public, investor/demo-facing frontend for the **Spectre CIA Trace** engine. It
sends a prompt to a private Hugging Face **ZeroGPU** Gradio Space that runs a
single forward pass through `Qwen/Qwen2.5-7B-Instruct`, scores 9 security
concepts, and returns a compound Trace verdict — then renders it as an
Eigan-branded "watch the model think across its depth" console.

> **CIA is a sensor, not a guardrail.** Verdicts describe what the model's forward
> pass looked like internally — not whether the eventual response was safe.
> Enforcement is a separate downstream (Sentinel) decision.

| | |
|---|---|
| **Live** | https://spectre-frontend-murex.vercel.app |
| **Repo** | https://github.com/eigan-ai/spectre-frontend |
| **Backend Space** | `james-ra-henry/spectre-cia-zerogpu-test` (private, ZeroGPU) |
| **Stack** | Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Vercel |

---

## Architecture

```
                          gated by middleware (login required)
                                        │
[ browser ] ──login──▶ /api/login ──────┼─────────▶ sets HMAC session cookie
     │                                   │
     │ ⌘/Ctrl+Enter                      ▼
     └──── POST /api/trace ─────▶ [ Next.js route handler ] ──@gradio/client──▶ [ private HF Space ]
                                    holds HF_TOKEN (server)    predict("/run_trace")   ZeroGPU: Qwen2.5-7B
                                    never sent to browser                              + 9-concept probes
                                         │
                                         └── after() ──▶ Mattermost webhook (optional)
```

Key properties:
- **The private Space stays private.** The HF token lives only in the server-side
  route handler and is never bundled to the client (verified: not in `.next/static`).
- **The whole site is gated** behind a login (see below); `/api/trace` is gated too,
  so the GPU can't be hit anonymously.
- **The backend contract is `/run_trace`.** The Space exposes the Gradio event
  `run_trace` (`api_name="run_trace"`); its **last output** is `json.dumps(report)`
  — the full structured report. The proxy parses that. (We originally tried a
  dedicated `gr.api` JSON endpoint, but `gr.api` doesn't exist in the pinned
  `gradio==5.9.1`, so we reuse the event. Full contract for the backend team lives
  in `FRONTEND_INTEGRATION.md` in the Space repo.)

The typed mirror of the report contract is `lib/spectre.ts`.

---

## Access gate (auth)

The frontend is public, so a lightweight login blocks casual access and lets us
attribute usage to an email.

- **`middleware.ts`** redirects unauthenticated page requests to `/login` and
  returns `401` for protected API routes (including `/api/trace`).
- **`/login`** collects an **email** (format-checked only — *not verified*, purely
  for tracking) and a **password**.
- **`/api/login`** checks the password against the comma-delimited **`ACCESS_PASSWORDS`**
  env var (default `internal_admin`), then sets an **HMAC-signed session cookie**
  (`lib/auth.ts`, Web Crypto, 7-day, httpOnly) signed with **`AUTH_SECRET`**.
- The header shows the signed-in email + a **Log out** button (`/api/logout`).
- **Handing out access = add a password to `ACCESS_PASSWORDS` and redeploy.** No code change.

> ⚠️ `AUTH_SECRET` must be set in production. Without it the cookie is signed with an
> insecure fallback and the gate can be forged.

---

## Observability / tracking

Every login and trace is attributed to the user's email:

- **Server logs** (visible in Vercel): `[access] login email=… ip=…` and
  `[trace] email=… chars=… verdict=… tier=…`.
- **Mattermost** (optional): set **`MATTERMOST_WEBHOOK_URL`** to an incoming-webhook
  URL and the app posts to that channel on every **login** (🔑 email + IP) and
  **trace** (🔍 email + prompt + verdict, color-coded by signal tier). Best-effort and
  non-blocking via `after()` — zero added latency, and a Mattermost outage never
  breaks a request. Unset → disabled. `lib/mattermost.ts`; drop the "Prompt" field
  there for metadata-only logging.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `HF_TOKEN` | ✅ | — | Server-only HF token the proxy uses to reach the private Space. |
| `AUTH_SECRET` | ✅ (prod) | dev fallback | Signs the session cookie. Generate: `openssl rand -hex 32`. |
| `ACCESS_PASSWORDS` | — | `internal_admin` | Comma-delimited valid login passwords. |
| `MATTERMOST_WEBHOOK_URL` | — | (disabled) | Incoming-webhook URL for login/trace notifications. |
| `MATTERMOST_CHANNEL` | — | webhook default | Override the Mattermost channel. |
| `SPECTRE_SPACE_ID` | — | `james-ra-henry/spectre-cia-zerogpu-test` | Override the backend Space. |

All are **server-only** — none are exposed to the browser. Copy `.env.example` →
`.env.local` for local dev; set the same in Vercel for production (a change requires
a **redeploy** to take effect).

---

## Local development

```bash
cp .env.example .env.local        # then fill in HF_TOKEN + AUTH_SECRET
npm install
npm run dev                       # http://localhost:3000 → login gate first
```

Sign in with any email + `internal_admin`. Requests hit ZeroGPU, which allocates a
GPU per call — **the first trace after idle is slow** while the 7B model reloads;
the UI shows a staged loader for this.

---

## Project structure

| Path | Purpose |
|---|---|
| `app/page.tsx` | Trace console — input, examples, results orchestration |
| `app/login/page.tsx` | Login form |
| `app/api/trace/route.ts` | Server proxy: gate-checked, holds `HF_TOKEN`, per-IP throttle, calls `/run_trace` |
| `app/api/login/route.ts` · `logout/route.ts` | Session issue/clear + email tracking |
| `middleware.ts` | The access gate |
| `lib/auth.ts` | HMAC session-cookie helpers (edge-safe) |
| `lib/mattermost.ts` | Best-effort webhook notifications |
| `lib/spectre.ts` | TypeScript contract for the report + concept metadata |
| `components/layer-trace-chart.tsx` | The layer-by-layer separation-curve visual (recharts) |
| `components/signal-indicator.tsx` | Verdict readout (enforced / observed / clean) |
| `components/concept-scores.tsx` | Per-concept score-vs-threshold bars |
| `components/module-reports.tsx` | Surface / CAZ / Deep / GEM cards |
| `app/globals.css` | Eigan design tokens + the 3-tier signal palette |

---

## Design system

Styled to the **Eigan** brand (source of truth: the `Eigan-Brand-Guidelines` Figma).
Tokens in `app/globals.css`:

- **Type:** Barlow (display/UI), DM Sans (body), JetBrains Mono (data/labels).
- **Palette:** Midnight Navy `#1B2355`, Signal Blue `#2855A0`, Open Cyan `#00B0D8`,
  Clarity Green `#3A8F3A`, Lime Logic `#8DC63F`, white ground.
- **Discipline:** radius 0–2px, hairline borders, **no gradients, no drop shadows**,
  whitespace is structural.
- **Verdict signal scale (3 tiers):** enforced `#d4183d` · observed `#e8a33d`
  (the one sanctioned amber extension) · clean `#3a8f3a`.

---

## Deployment (Vercel + GitHub)

**Active mechanism: Vercel's native Git integration.** Merging/pushing to `main`
auto-deploys to production; every PR gets a preview URL. Set the environment
variables above in the Vercel project (and redeploy after changes).

The repo also ships GitHub Actions in `.github/workflows/`:
- **`ci.yml`** — lint + typecheck + build on every push/PR (active safety gate).
- **`deploy.yml`** — a *repo-owned* Vercel deploy pipeline that stays **dormant**
  unless you add `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` repo secrets.
  Leaving them unset avoids double-deploys with the native integration. (Use this
  path only if you prefer the deploy pipeline defined in-repo; if so, turn off
  Vercel's native auto-deploy.)

> ZeroGPU cold starts can exceed the default serverless timeout. The trace route
> sets `maxDuration = 300`; ensure your Vercel plan permits it.

---

## Known issues & follow-ups

- **Probe calibration (backend, not frontend):** the test Space's thresholds are low,
  so benign/neutral prompts read **ENFORCED**. The frontend faithfully renders what the
  sensor returns; a calibration pass (or a curated clean example set) is needed before
  a live investor demo. Documented for the backend team in `FRONTEND_INTEGRATION.md`.
- **Durable rate limiting:** `/api/trace` and `/api/login` use best-effort in-memory
  per-IP throttles that reset per serverless instance. Swap for Upstash/Vercel KV before
  wide public traffic (the login gate is the primary GPU-spend guard).
- **`middleware` → `proxy`:** Next 16 renamed the middleware file convention; `middleware.ts`
  still works with a deprecation notice. Migrate when convenient.

---

## What was built (summary)

Backend (Space, additive — Gradio UI untouched and kept for research/dev):
- Extracted `_run_trace_core`; report now carries `signal` (enforced/observed/clean,
  computed server-side) and `trace_time_ms`; stable `api_name="run_trace"`.

Frontend (this repo):
- Eigan-branded trace console with animated layer-depth chart, signal readout,
  concept score bars, module reports, raw-JSON drawer, staged ZeroGPU loader.
- Token-safe `/api/trace` proxy; email + password access gate; Mattermost
  notifications; CI/CD; deployed on Vercel.
