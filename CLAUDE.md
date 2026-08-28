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
- `PORT=3001`, `CLIENT_ORIGIN=http://localhost:5173`

**Never expose or log `server/.env` contents.**

## Architecture

The client (`/client/src/App.jsx`) owns all state and orchestrates a multi-step flow: upload → detect → configure → analyze → visualize. Vite proxies all `/api/*` requests to the server at port 3001 (`vite.config.js`).

The server (`/server/index.js`) is an Express app with ES modules. Routes are thin — they handle multipart uploads (multer, 10 MB limit), then delegate to services.

### Request flow for a full analysis

1. **`POST /api/detect-items`** (`routes/detect.js`) — uploads room photo, runs `claude-haiku-4-5-20251001` to return 6–8 furniture label strings as JSON.

2. **`POST /api/analyze`** (`routes/analyze.js`) — uploads room photo again with vibe, budget, existing furniture, and optional refinement/history. Calls `claudeService.js` directly; Claude estimates room proportions from the photo itself.

3. **`services/claudeService.js`** — the core prompt layer. Uses `claude-opus-4-8`. Builds a structured prompt with mandatory requirements, budget, and existing-furniture constraints. Returns JSON: `{ roomAnalysis, suggestions[6], paintColors[2] }`. Each suggestion has `item`, `placement`, `reason`, `spatialFit` (good/tight/warning), `spatialNote`, `productQuery`, `priceEstimate`.

4. **`POST /api/products`** (`routes/products.js`) → `productSearchService.js` — takes the 6 suggestions and searches Google Shopping via SerpAPI for each. Picks the best result with a thumbnail; falls back to constructed Amazon/Wayfair/Target search URLs when nothing usable comes back.

5. **`POST /api/visualize`** (`routes/visualize.js`) → `services/visualizationService.js` — two-step process: Claude (`claude-opus-4-8`) writes a precise edit instruction from the photo + suggestion list, then an image model edits the actual room photo. Tries `openai/gpt-image-2/edit` first (via fal.ai) when product reference photos are available, falling back to `fal-ai/flux-pro/kontext/max/multi`, then `fal-ai/flux-pro/kontext` (single-image, text-only) if no product photos exist. Returns base64 JPEG.

6. **`POST /api/convert-image`** (`routes/convert.js`) — converts HEIC/HEIF uploads to JPEG via sharp before the client re-submits.

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
