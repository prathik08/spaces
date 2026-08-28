import Anthropic from '@anthropic-ai/sdk';
import { fal } from '@fal-ai/client';

async function fetchAsDataUrl(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || 'image/jpeg';
  return `data:${ct};base64,${buf.toString('base64')}`;
}

function buildSingleImagePrompt(suggestions, vibe, refinement) {
  const itemCounts = suggestions.reduce((acc, s) => {
    const key = s.item.toLowerCase().trim();
    acc[key] = acc[key] || { item: s.item, count: 0 };
    acc[key].count += 1;
    return acc;
  }, {});
  const itemList = Object.values(itemCounts)
    .map(({ item, count }) => (count > 1 ? `${count}x ${item}` : item))
    .join(', ');

  return `You are writing an instruction for an AI image editor that will edit THIS exact photo.
The editor preserves the room's layout, walls, floors, windows, doors, and perspective exactly — it only adds or swaps decor.

Write a single editing instruction (2–3 sentences) that:
1. Keeps every architectural feature exactly as-is (note the specific ones: hallway, windows, doors, ceiling height, flooring)
2. Describes placing these items naturally in the space: ${itemList}. If any item has a quantity prefix like "2x", place exactly that many units of it in the scene — never fewer.
3. Applies a ${vibe} aesthetic through lighting, color tone, and styling
${refinement?.trim() ? `4. Incorporates this specific user request: "${refinement.trim()}" — prioritize this above all else` : ''}

Start with "Keep the exact room layout unchanged." Then describe the additions. No preamble.`;
}

function buildMultiImagePrompt(productEntries, suggestions, vibe, refinement) {
  const productLines = productEntries
    .map((e, i) => {
      const title = e.suggestion.product?.title || e.suggestion.item;
      return `  • Image ${i + 2} shows: ${title} — place it exactly as it appears at: ${e.suggestion.placement}`;
    })
    .join('\n');
  const textOnlyItems = suggestions
    .filter((s) => !s.product?.imageUrl)
    .map((s) => `  • ${s.item} (no photo reference) — place it at: ${s.placement}`)
    .join('\n');

  return `You are writing an edit instruction for an AI that will receive these images:
  • Image 1: the room photo to edit (keep all architecture exactly as-is)
${productLines}
${textOnlyItems ? textOnlyItems : ''}

Write a single instruction (3–4 sentences) telling the AI to:
1. Preserve the room exactly — walls, floor, doors, windows, ceiling, existing fixed elements unchanged
2. Place each product from its reference image into the room at the specified position, matching its exact appearance from the photo (color, material, shape, style)
3. Achieve a ${vibe} aesthetic through lighting and styling
${refinement?.trim() ? `4. Also: "${refinement.trim()}"` : ''}

Be explicit: say "using the chair shown in image 2" or "the lantern from image 3" so the AI knows which reference to use for each item. Start with "Keep the room structure exactly as shown." No preamble.`;
}

export async function generateVisualization(imageBuffer, mimeType, vibe, suggestions, refinement) {
  fal.config({ credentials: process.env.FAL_KEY });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

  // Try to fetch product thumbnails; silently drop any that fail
  const productEntries = suggestions
    .map((s, i) => ({ index: i, suggestion: s, imageUrl: s.product?.imageUrl }))
    .filter((e) => e.imageUrl);

  const fetchedEntries = (
    await Promise.all(
      productEntries.map(async (e) => {
        try {
          const dataUrl = await fetchAsDataUrl(e.imageUrl);
          return { ...e, dataUrl };
        } catch (err) {
          console.warn(`[viz] skipping product image (${err.message}): ${e.imageUrl}`);
          return null;
        }
      })
    )
  ).filter(Boolean);

  const useMulti = fetchedEntries.length > 0;
  console.log(`[viz] useMulti=${useMulti}, fetchedEntries=${fetchedEntries.length}/${productEntries.length}`);

  // Step 1: Claude writes the edit instruction
  const promptText = useMulti
    ? buildMultiImagePrompt(fetchedEntries, suggestions, vibe, refinement)
    : buildSingleImagePrompt(suggestions, vibe, refinement);

  const promptResponse = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
        { type: 'text', text: promptText },
      ],
    }],
  });

  const editInstruction = promptResponse.content[0].text.trim();
  console.log('[viz] edit instruction:', editInstruction.slice(0, 120));

  // Step 2: Run fal.ai
  // Priority: GPT Image 2 (best product fidelity) → FLUX Kontext multi → FLUX Kontext single
  let imageUrl;
  const allImageUrls = [imageDataUrl, ...fetchedEntries.map((e) => e.dataUrl)];

  if (useMulti) {
    // Try GPT Image 2 first — natively multimodal, best at placing exact product appearances
    try {
      const result = await fal.subscribe('openai/gpt-image-2/edit', {
        input: {
          prompt: editInstruction,
          image_urls: allImageUrls,
        },
      });
      imageUrl = result.data.images[0].url;
      console.log('[viz] GPT Image 2 success');
    } catch (gptErr) {
      console.warn('[viz] GPT Image 2 failed, trying FLUX Kontext multi:', gptErr.message);
      // Fall back to FLUX Kontext multi
      try {
        const result = await fal.subscribe('fal-ai/flux-pro/kontext/max/multi', {
          input: {
            prompt: editInstruction,
            image_urls: allImageUrls,
          },
        });
        imageUrl = result.data.images[0].url;
        console.log('[viz] FLUX Kontext multi success');
      } catch (multiErr) {
        console.warn('[viz] FLUX multi failed, falling back to single:', multiErr.message);
        const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
          input: {
            prompt: editInstruction,
            image_url: imageDataUrl,
            guidance_scale: 3.5,
            num_inference_steps: 28,
            strength: 0.75,
          },
        });
        imageUrl = result.data.images[0].url;
        console.log('[viz] FLUX Kontext single success (fallback)');
      }
    }
  } else {
    const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
      input: {
        prompt: editInstruction,
        image_url: imageDataUrl,
        guidance_scale: 3.5,
        num_inference_steps: 28,
        strength: 0.75,
      },
    });
    imageUrl = result.data.images[0].url;
    console.log('[viz] FLUX Kontext single (no product images)');
  }

  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { base64: buffer.toString('base64'), contentType: 'image/jpeg' };
}
