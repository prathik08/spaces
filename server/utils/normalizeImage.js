import sharp from 'sharp';

const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export async function normalizeImage(buffer, mimetype) {
  if (SUPPORTED.has(mimetype)) return { buffer, mimetype };
  // Convert anything else (HEIC, TIFF, AVIF, etc.) to JPEG
  const converted = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  return { buffer: converted, mimetype: 'image/jpeg' };
}
