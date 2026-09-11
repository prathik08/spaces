# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Spaces** — a React + Express app where users upload a room photo, pick a vibe, and get spatially-aware decor suggestions with shop links and an AI-generated room visualization.

## Dev Commands

Two separate processes must both be running:

```bash
# Server (port 3001) — run from /server
cd server && npm run dev   # nodemon, ES modules

# Client (port 5173) — run from /client
cd client && npm run dev   # Vite

# Kill ports if processes are stuck
lsof -ti :3001 | xargs kill -9; lsof -ti :5173 | xargs kill -9
```

No test suite exists. No linting config exists.

## Environment

Copy `.env.example` to `server/.env` and fill in:
- `ANTHROPIC_API_KEY` — for Claude analysis, item detection, and visualization prompts
- `FAL_KEY` — for fal.ai image generation (~$0.04–0.08/image)
- `SERPAPI_KEY` — for Google Shopping product search (`/api/products`)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth App credentials (see `.env.example` for how to register one — its callback URL is the CLIENT's domain, not this server's)
- `SESSION_SECRET` — random string used to sign session cookies
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — saved-analyses storage (run `server/db/schema.sql` once in the Supabase SQL Editor to create the table)
- `PORT=3001`, `CLIENT_ORIGIN=http://localhost:5173`

**Never expose or log `server/.env` contents.**

## Architecture

The client (`/client/src/App.jsx`) owns all state and orchestrates a multi-step flow: upload → detect → configure → analyze → visualize. Vite proxies all `/api/*` requests to the server at port 3001 (`vite.config.js`).

The server (`/server/index.js`) is an Express app with ES modules. Routes are thin — they handle multipart uploads (multer, 10 MB limit), then delegate to services.

### Auth

Every route that calls a metered API (`/api/analyze`, `/api/visualize`, `/api/detect-items`, `/api/products`) is gated behind GitHub OAuth via `requireAuth` (`middleware/requireAuth.js`) — any signed-in GitHub account is accepted, there's no allowlist. `routes/auth.js` handles the OAuth redirect/callback and issues a signed JWT in an httpOnly cookie (`services/authService.js`); the client checks `/api/auth/me` on load and shows `components/SignIn.jsx` when unauthenticated. This exists specifically so a shared/public link can't be used to run up the API bill anonymously — the per-IP rate limiter below is a second layer on top of it, not a replacement.

In production, `client/vercel.json` proxies all `/api/*` requests through to the server, and `callbackUrl()` in `routes/auth.js` builds the OAuth redirect using `CLIENT_ORIGIN`, not the server's own URL — both exist so the session cookie ends up first-party to the client's domain instead of cross-site. Skipping the proxy (e.g. pointing the client directly at the server via `VITE_API_URL`) makes the cookie cross-site, which desktop browsers mostly tolerate but mobile browsers routinely block, breaking sign-in silently (GitHub auth succeeds, but `/api/auth/me` never sees the cookie afterward).

`/api/saves` (`routes/saves.js` → `services/savesService.js`) is also behind `requireAuth`, since saves are owned by `req.user.login` — every query/mutation filters on `owner`, so one GitHub user can never read or touch another's rows even though the server uses Supabase's `service_role` key (which otherwise bypasses RLS entirely). Saves cap at 5 per owner, oldest pruned on insert, matching the previous localStorage behavior.

### Request flow for a full analysis

1. **`POST /api/detect-items`** (`routes/detect.js`) — uploads room photo, runs `claude-haiku-4-5-20251001` to return 6–8 furniture label strings as JSON.

2. **`POST /api/analyze`** (`routes/analyze.js`) — uploads room photo again with vibe, budget, existing furniture, and optional refinement/history. Calls `claudeService.js` directly; Claude estimates room proportions from the photo itself.

3. **`services/claudeService.js`** — the core prompt layer. Uses `claude-opus-4-8`. Builds a structured prompt with mandatory requirements, budget, and existing-furniture constraints. Returns JSON: `{ roomAnalysis, suggestions[6], paintColors[2] }`. Each suggestion has `item`, `placement`, `reason`, `spatialFit` (good/tight/warning), `spatialNote`, `productQuery`, `priceEstimate`.

4. **`POST /api/products`** (`routes/products.js`) → `productSearchService.js` — takes the 6 suggestions and searches Google Shopping via SerpAPI for each. Picks the best result with a thumbnail; falls back to constructed Amazon/Wayfair/Target search URLs when nothing usable comes back.

5. **`POST /api/visualize`** (`routes/visualize.js`) → `services/visualizationService.js` — two-step process: Claude (`claude-opus-4-8`) writes a precise edit instruction from the photo + suggestion list, then an image model edits the actual room photo. Tries `openai/gpt-image-2/edit` first (via fal.ai) when product reference photos are available, falling back to `fal-ai/flux-pro/kontext/max/multi`, then `fal-ai/flux-pro/kontext` (single-image, text-only) if no product photos exist. Returns base64 JPEG.

6. **`POST /api/convert-image`** (`routes/convert.js`) — converts HEIC/HEIF uploads to JPEG via `heic-convert` (bundles its own WASM decoder) before the client re-submits. `sharp`'s bundled libheif can't decode real iPhone photos — they're HEVC-compressed, and prebuilt `sharp`/libvips binaries exclude HEVC decoding for licensing reasons.

### Image handling

`utils/normalizeImage.js` (sharp) normalizes uploads to JPEG before any Claude or fal.ai call.

## Design System

CSS variables in `client/src/App.css`:
- `--bg: #eae6dd` (warm cream), `--surface: #f5f2eb`, `--accent: #5e6e4c` (olive/sage), `--text: #1c1a16`, `--text-muted: #7a7168`
- `--radius: 4px`, `--radius-lg: 8px`
- Fonts: EB Garamond (headings), Inter (body)
- No emojis anywhere — bullet points via CSS `::before`

## Known Issues

None currently tracked.
