import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { normalizeImage } from '../utils/normalizeImage.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/detect-items', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { buffer, mimetype } = await normalizeImage(req.file.buffer, req.file.mimetype);
    const base64Image = buffer.toString('base64');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimetype, data: base64Image } },
          {
            type: 'text',
            text: 'List 6–8 specific furniture and decor items visible in this room. Short labels only — 2–4 words each. Respond ONLY with a valid JSON array of strings, nothing else. Example: ["grey sectional", "wooden coffee table", "floor lamp", "throw pillows"]',
          },
        ],
      }],
    });

    const raw = response.content[0].text.trim();
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const items = JSON.parse(clean);
    res.json({ items: Array.isArray(items) ? items : [] });
  } catch (err) {
    console.error('Detect error:', err);
    res.status(500).json({ items: [] });
  }
});

export default router;
