import express from 'express';
import multer from 'multer';
import convert from 'heic-convert';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

router.post('/convert-image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  try {
    // sharp's bundled libheif can't decode real iPhone photos (HEVC-compressed —
    // excluded from prebuilt binaries for licensing reasons). heic-convert ships
    // its own WASM decoder instead of relying on a system/native codec.
    const jpeg = await convert({ buffer: req.file.buffer, format: 'JPEG', quality: 0.9 });
    res.set('Content-Type', 'image/jpeg');
    res.send(Buffer.from(jpeg));
  } catch (err) {
    console.error('Convert error:', err.message);
    res.status(500).json({ error: 'Could not convert image. Please save as JPEG from your Photos app and re-upload.' });
  }
});

export default router;
