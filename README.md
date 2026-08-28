# Spaces

Upload a photo of a room, pick a vibe and a budget, and get back spatially-aware
decor suggestions — each one matched to a real shoppable product — plus an
AI-generated visualization of the room with those suggestions applied.

**[Live demo →](#)** _(add your deployed URL here)_

> **TODO:** add screenshots — run the app locally, upload a room photo, and
> capture the input flow and the results/visualization screens into `docs/`,
> then embed them here with `![Results screen](docs/screenshot-results.png)`.

## How it works

1. **Upload a room photo.** Claude (Haiku) scans it and detects the furniture
   already in the room, so you can tell it what to keep vs. replace.
2. **Describe what you want** (optional free text + quick-pick chips), **pick a
   vibe** (Cozy, Japandi, Dark Academia, etc.), and **set a budget**.
3. **Claude (Opus) analyzes the photo** and returns 6 specific decor
   suggestions — each with placement, reasoning, a spatial-fit rating
   (good / tight / warning), and a price estimate — plus 2 real paint colors
   (Sherwin-Williams / Benjamin Moore) that suit the room and vibe.
4. **Product search** runs each suggestion through Google Shopping (SerpAPI)
   and attaches a real product photo, price, and retailer link, falling back
   to constructed Amazon/Wayfair/Target search links when nothing relevant
   comes back.
5. **Visualization**: Claude writes a precise image-edit instruction from the
   photo + suggestions, then an image model (GPT Image 2 or FLUX Kontext, via
   fal.ai) edits the actual room photo to show the result — preserving the
   real layout, walls, and windows.
6. **Refine**: saved analyses can be re-run with follow-up feedback
   ("swap the rug for something darker", "make it less cramped") — Claude
   treats prior requirements as non-negotiable constraints, not suggestions to
   revisit.

## Tech stack

| | |
|---|---|
| Client | React 18 + Vite |
| Server | Express (ES modules) |
| Room analysis, item detection, image-edit prompts | Claude (Opus + Haiku) via `@anthropic-ai/sdk` |
| Room visualization | fal.ai (GPT Image 2 / FLUX Kontext) |
| Product search | SerpAPI (Google Shopping) |
| Image normalization | sharp (HEIC/TIFF/etc. → JPEG) |
| Persistence | localStorage (client-side only, last 5 analyses) |

## Running locally

Two processes, two terminals:

```bash
# Server — http://localhost:3001
cd server
cp ../.env.example .env   # fill in your API keys
npm install
npm run dev

# Client — http://localhost:5173
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to the server, so no
client-side env config is needed for local dev.

### Required API keys (`server/.env`)

- `ANTHROPIC_API_KEY` — Claude analysis, item detection, visualization prompts
- `FAL_KEY` — fal.ai image generation (~$0.04–0.08/image)
- `SERPAPI_KEY` — Google Shopping product search

## Deployment

This is a two-part deploy: a static client and a small API server.

- **Client → Vercel.** Set the project root to `client/`. If the server is
  hosted elsewhere, set `VITE_API_URL` to its URL (see `client/.env.example`).
- **Server → Render** (or any Node host). Set `CLIENT_ORIGIN` to the deployed
  client's URL and add the three API keys above as environment variables.

The two costly routes (`/api/analyze`, `/api/visualize`) are rate-limited
per-IP (10 requests/hour) since they call metered APIs — worth knowing if
you're testing against a live deployment rather than localhost.

## Known limitations

- Persistence is localStorage only (last 5 analyses, per browser) — there's
  no backend database. The storage layer (`client/src/lib/analysisStore.js`,
  `storageAdapter.js`) is written to swap in a real backend later without
  touching call sites.
- No auth — anyone with the deployed URL can use it, subject to the rate limit
  above.
- Free-tier hosting (e.g. Render) spins down after inactivity — the first
  request after idle can take 30–50s to cold-start.
