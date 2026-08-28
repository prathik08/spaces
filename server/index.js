import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import analyzeRouter from './routes/analyze.js';
import visualizeRouter from './routes/visualize.js';
import detectRouter from './routes/detect.js';
import convertRouter from './routes/convert.js';
import productsRouter from './routes/products.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

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

app.use('/api', analyzeRouter);
app.use('/api', visualizeRouter);
app.use('/api', detectRouter);
app.use('/api', convertRouter);
app.use('/api', productsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
