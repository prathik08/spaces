import express from 'express';
import multer from 'multer';
import sharp from 'sharp';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

router.post('/convert-image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  try {
    const jpeg = await sharp(req.file.buffer).jpeg({ quality: 90 }).toBuffer();
    res.set('Content-Type', 'image/jpeg');
    res.send(jpeg);
  } catch (err) {
    console.error('Convert error:', err.message);
    res.status(500).json({ error: 'Could not convert image. Please save as JPEG from your Photos app and re-upload.' });
  }
});

export default router;
