import express from 'express';
import multer from 'multer';
import { generateVisualization } from '../services/visualizationService.js';
import { normalizeImage } from '../utils/normalizeImage.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

router.post('/visualize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const { vibe, suggestions, refinement } = req.body;
    if (!vibe || !suggestions) return res.status(400).json({ error: 'Missing vibe or suggestions' });

    const parsedSuggestions = JSON.parse(suggestions);
    const { buffer, mimetype } = await normalizeImage(req.file.buffer, req.file.mimetype);
    const { base64, contentType } = await generateVisualization(
      buffer,
      mimetype,
      vibe,
      parsedSuggestions,
      refinement
    );

    res.json({ image: `data:${contentType};base64,${base64}` });
  } catch (err) {
    console.error('Visualize error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate visualization' });
  }
});

export default router;
