import express from 'express';
import multer from 'multer';
import { getDecorSuggestions } from '../services/claudeService.js';
import { normalizeImage } from '../utils/normalizeImage.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});


router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }
    const { vibe, budget, existingFurniture, userContext, refinement, previousSuggestions, refinementHistory } = req.body;
    if (!vibe) {
      return res.status(400).json({ error: 'No vibe selected' });
    }

    const parsedBudget = budget ? parseInt(budget, 10) : null;
    const { buffer, mimetype } = await normalizeImage(req.file.buffer, req.file.mimetype);

    const parsedPrev = previousSuggestions ? JSON.parse(previousSuggestions) : null;
    const parsedHistory = refinementHistory ? JSON.parse(refinementHistory) : null;
    const result = await getDecorSuggestions(buffer, mimetype, vibe, {
      budget: parsedBudget,
      existingFurniture,
      userContext,
      refinement,
      previousSuggestions: parsedPrev,
      refinementHistory: parsedHistory,
    });

    res.json(result);
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze room' });
  }
});

export default router;
