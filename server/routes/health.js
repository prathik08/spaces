import express from 'express';
import { ping } from '../services/savesService.js';

const router = express.Router();

// Hit on a schedule by .github/workflows/keepalive.yml to keep Supabase's
// free-tier project from auto-pausing after ~a week of no API activity.
// Deliberately unauthenticated (nothing to sign in with in a cron job) and
// outside the costly-route rate limiter — it's one cheap read, not a
// metered Claude/fal.ai/SerpAPI call.
router.get('/health', async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true });
  } catch (err) {
    console.error('Health check error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
