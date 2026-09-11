import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth.js';
import analyzeRouter from './routes/analyze.js';
import visualizeRouter from './routes/visualize.js';
import detectRouter from './routes/detect.js';
import convertRouter from './routes/convert.js';
import productsRouter from './routes/products.js';
import savesRouter from './routes/saves.js';
import { requireAuth } from './middleware/requireAuth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
// A save's JSON body carries the room photo (and possibly a visualization
// image) as data URLs — Express's default 100kb limit is far too small for
// that, so raise it in line with the 10MB image limits multer enforces
// elsewhere.
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// Analyze and visualize call metered, paid APIs (Claude Opus, fal.ai image gen) —
// cap per-IP usage so a bot or shared link can't run up an unbounded bill.
const costlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached for this demo — try again in a bit.' },
});

app.use('/api/analyze', costlyLimiter);
app.use('/api/visualize', costlyLimiter);

app.use('/api', authRouter);

// Everything below calls a metered API (Claude and/or fal.ai and/or SerpAPI) — require
// a signed-in GitHub session so an anonymous visitor/bot can't run up the bill.
app.use('/api/analyze', requireAuth);
app.use('/api/visualize', requireAuth);
app.use('/api/detect-items', requireAuth);
app.use('/api/products', requireAuth);
// Saved analyses are keyed by GitHub login, so this always requires a session too.
app.use('/api/saves', requireAuth);

app.use('/api', analyzeRouter);
app.use('/api', visualizeRouter);
app.use('/api', detectRouter);
app.use('/api', convertRouter);
app.use('/api', productsRouter);
app.use('/api', savesRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
