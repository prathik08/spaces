# Spaces

Upload a photo of a room, pick a vibe and a budget, and get back spatially-aware
decor suggestions — each one matched to a real shoppable product — plus an
AI-generated visualization of the room with those suggestions applied.

**[Live demo →](https://spaces-nine.vercel.app)**

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

Every step that calls a paid API is gated behind **GitHub sign-in** — any
GitHub account works, there's no allowlist — plus a per-IP rate limit, so a
shared link can't be used to run up the bill anonymously.

## Tech stack

| | |
|---|---|
| Client | React 18 + Vite |
| Server | Express (ES modules) |
| Room analysis, item detection, image-edit prompts | Claude (Opus + Haiku) via `@anthropic-ai/sdk` |
| Room visualization | fal.ai (GPT Image 2 / FLUX Kontext) |
| Product search | SerpAPI (Google Shopping) |
| Image normalization | sharp (general formats) + heic-convert (real iPhone HEIC/HEVC photos) |
| Auth | GitHub OAuth, signed JWT in an httpOnly cookie |
| Persistence | Supabase (Postgres) — saved analyses, keyed by GitHub login, last 5 per user |

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

### Required env vars (`server/.env`)

- `ANTHROPIC_API_KEY` — Claude analysis, item detection, visualization prompts
- `FAL_KEY` — fal.ai image generation (~$0.04–0.08/image)
- `SERPAPI_KEY` — Google Shopping product search
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth App credentials
  (register one at github.com/settings/developers — see `.env.example` for
  the exact callback URL it needs)
- `SESSION_SECRET` — random string for signing session cookies
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — where saved analyses live
  (create a project at supabase.com, then run `server/db/schema.sql` once in
  its SQL Editor to create the table)

## Deployment

This is a two-part deploy — a static client and a small API server — but
the client proxies all `/api/*` requests through to the server
(`client/vercel.json`), so the browser only ever sees one origin. This
matters for auth: without it, the session cookie is cross-site between the
two domains, which desktop browsers mostly tolerate but mobile browsers
frequently block outright.

- **Server → Render** (or any Node host). Set `CLIENT_ORIGIN` to the
  deployed *client's* URL, `NODE_ENV=production` (needed for the session
  cookie's secure/cross-site settings), and the env vars above.
- **Client → Vercel.** Set the project root to `client/`. Leave
  `VITE_API_URL` unset — update `client/vercel.json`'s rewrite destination
  to point at your Render URL instead.
- The GitHub OAuth App's **Authorization callback URL** must be the
  *client's* domain (`https://your-client.vercel.app/api/auth/github/callback`),
  not the server's — that's what makes the session cookie land on the
  right origin. You'll need a **second OAuth App** for production; each one
  only supports a single callback URL, so the local-dev app (pointed at
  `localhost:5173`) can't double as the production one.
- The Supabase project/table can be shared between local dev and
  production — just add the same `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
  to Render's environment variables.

The two costly routes (`/api/analyze`, `/api/visualize`) are rate-limited
per-IP (10 requests/hour) on top of the GitHub sign-in gate, since they call
metered APIs — worth knowing if you're testing against a live deployment
rather than localhost.

## Known limitations

- Saved analyses cap at 5 per user (oldest gets pruned on save), same as the
  old localStorage limit — images are stored as compressed data URLs directly
  in the Postgres row rather than in object storage, which is simple but
  won't scale indefinitely; a Supabase Storage bucket would be the next step
  if row sizes become a problem.
- Auth is a sign-in gate (any GitHub account), not a real accounts system —
  there's no admin controls beyond the shared per-IP rate limit and the
  5-saves-per-user cap.
- Anyone with saves from before this feature existed (still sitting in that
  browser's localStorage) gets them migrated into their account automatically
  on next sign-in — see `migrateLegacySaves()` in `analysisStore.js`.
- Free-tier hosting (e.g. Render) spins down after inactivity — the first
  request after idle can take 30–50s to cold-start.
