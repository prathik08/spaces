/**
 * storageAdapter — all "persist an image" logic lives here.
 *
 * Today: compress to a data URL and return it (data URL IS the image reference).
 * Supabase swap: upload buffer/blob to Supabase Storage, return the public URL.
 *   Replace the body of `saveImage` with:
 *     const { data, error } = await supabase.storage.from('rooms').upload(path, blob);
 *     return supabase.storage.from('rooms').getPublicUrl(data.path).data.publicUrl;
 *   No callers need to change — they already treat the return value as an opaque URL string.
 */

export async function saveImage(dataUrl, { maxWidth = 500, quality = 0.72 } = {}) {
  return compress(dataUrl, maxWidth, quality);
}

function compress(dataUrl, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}
