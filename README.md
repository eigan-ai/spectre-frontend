# Spectre CIA — Inference Trace (Frontend)

An investor-facing frontend for the **Spectre CIA Trace** demo. It calls a
private Hugging Face **ZeroGPU** Gradio Space that runs a single forward pass
through `Qwen/Qwen2.5-7B-Instruct`, scores 9 security concepts, and returns a
compound Trace verdict. **CIA is a sensor, not a guardrail** — it reports what
the model's forward pass looked like internally, not whether the response was
safe.

Built with **Next.js (App Router) + TypeScript + Tailwind v4**, styled to the
**Eigan** brand system (source of truth: the `Eigan-Brand-Guidelines` Figma).

## Architecture

```
[ browser ]  --POST /api/trace-->  [ Next.js route handler ]  --@gradio/client-->  [ private HF Space ]
   UI only          (no secret)        holds HF_TOKEN (server)      predict("/trace")     ZeroGPU inference
```

The private Space stays private: the HF token lives only in the server-side
route handler (`app/api/trace/route.ts`) and never reaches the client bundle.
The Space exposes a JSON endpoint via `gr.api(api_name="trace")` returning the
full structured report (see `lib/spectre.ts` for the typed contract).

## Local development

```bash
# 1. Configure env (server-only).
cp .env.example .env.local
#   HF_TOKEN        = hf_...            (read token is enough)
#   ACCESS_PASSWORDS = internal_admin   (comma-delimited; add more as needed)
#   AUTH_SECRET     = $(openssl rand -hex 32)   (signs the session cookie)

# 2. Run
npm install
npm run dev
# open http://localhost:3000  → you'll hit the login gate first
```

### Mattermost notifications (optional)
Set **`MATTERMOST_WEBHOOK_URL`** to an incoming-webhook URL and the app posts to that
channel on every **login** (email + IP) and **trace** (email + prompt + verdict, colored
by signal tier). Best-effort and non-blocking (`after()`), so it never adds latency or
breaks a request. Unset → disabled. Optional `MATTERMOST_CHANNEL` overrides the webhook's
default channel. To log metadata only, remove the "Prompt" field in `lib/mattermost.ts`.

### Access gate
The site is behind a login (`middleware.ts` → `/login`). Users enter an **email**
(captured for tracking only — not verified) and a **password**. Valid passwords are
the comma-delimited **`ACCESS_PASSWORDS`** env var (defaults to `internal_admin`).
Login sets an HMAC-signed session cookie (7 days) signed with **`AUTH_SECRET`**;
`/api/trace` is also gated so the GPU can't be hit unauthenticated. To hand out
access, add a password to `ACCESS_PASSWORDS` and redeploy — no code change.

Requests hit ZeroGPU, which allocates a GPU per call — **the first trace after
idle is slow** while the 7B model reloads. The UI shows a staged loader for this.

## Key files

| Path | Purpose |
|---|---|
| `app/page.tsx` | Trace console — input, examples, and results orchestration |
| `app/api/trace/route.ts` | Server proxy: holds `HF_TOKEN`, calls the Space, throttles per-IP |
| `lib/spectre.ts` | TypeScript contract for the report + concept metadata |
| `components/layer-trace-chart.tsx` | The layer-by-layer separation-curve visual |
| `components/signal-indicator.tsx` | Verdict readout (enforced / observed / clean) |
| `components/concept-scores.tsx` | Per-concept score-vs-threshold bars |
| `app/globals.css` | Eigan design tokens + the 3-tier signal palette |

## Deployment (Vercel + GitHub)

CI/CD lives in `.github/workflows/`:
- **`ci.yml`** — lint + typecheck + build on every PR and push to `main`.
- **`deploy.yml`** — deploys to Vercel: **production on merge to `main`**, a
  **preview URL for every PR**.

### One-time setup
1. Create a Vercel project and link it to this repo (`vercel link`), or import
   the GitHub repo in the Vercel dashboard.
2. In the Vercel project, add Environment Variables (encrypted):
   - **`HF_TOKEN`** — the HF token for the proxy.
   - **`AUTH_SECRET`** — `openssl rand -hex 32`. **Required** — without it the session
     cookie is signed with an insecure fallback and the gate can be bypassed.
   - **`ACCESS_PASSWORDS`** — comma-delimited passwords (optional; defaults to `internal_admin`).
   - Changing any env var requires a **redeploy** to take effect.
3. Add three **GitHub repo secrets** (Settings → Secrets → Actions):
   - `VERCEL_TOKEN` — a Vercel access token
   - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` — from `.vercel/project.json` after
     `vercel link` (or the project settings)

After that, merging to `main` ships to production automatically.

> Note: ZeroGPU cold starts can exceed the default serverless timeout. The route
> requests `maxDuration = 300`; ensure your Vercel plan permits it (Hobby caps
> lower than Pro).
