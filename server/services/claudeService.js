import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a spatially-aware interior design assistant. You analyze room photos to make decor suggestions, estimating room proportions and spatial constraints directly from the image. Your job is to satisfy the user's stated requirements using that spatial reasoning — spatial constraints inform HOW you solve the problem, never WHETHER to solve it. If a user requires 2 seats, your job is to find 2 seats that fit, not to decide the space is too small for 2 seats.`;

export async function getDecorSuggestions(imageBuffer, mimeType, vibe, { budget, existingFurniture, userContext, refinement, previousSuggestions, refinementHistory } = {}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64Image = imageBuffer.toString('base64');

  const budgetContext = budget
    ? `BUDGET: The user has a total budget of $${budget} spread across all 6 suggestions combined. Distribute it sensibly — mix lower-cost and mid-range items so the total stays realistic. For each item include a realistic price estimate (e.g. "~$20–40") based on typical retail prices for that item type.`
    : '';

  const existingContext = existingFurniture?.trim()
    ? `EXISTING PIECES TO WORK AROUND: The user is keeping these items and cannot remove them: "${existingFurniture.trim()}". Every suggestion must complement these pieces in color, material, and style. Do not suggest anything that would clash.`
    : '';

  // Extract an explicit seating count from any text (e.g. "2 seat", "two chairs")
  const extractSeatCount = (text) => {
    if (!text) return null;
    const m = text.match(/\b(one|two|three|four|five|1|2|3|4|5)\s*[-\s]?\s*(seat|chair|seating|seats|chairs)/i);
    if (!m) return null;
    const word = m[1].toLowerCase();
    const map = { one: 1, two: 2, three: 3, four: 4, five: 5};
    return map[word] ?? parseInt(word, 10);
  };

  const allTexts = [userContext, ...(refinementHistory || []), refinement].filter(Boolean);
  // Use the most recently stated seating count, or the max if user re-asserted it
  const seatCounts = allTexts.map(extractSeatCount).filter(Boolean);
  const requiredSeats = seatCounts.length ? Math.max(...seatCounts) : null;

  // Collect all user requirements into a single mandatory block
  const allRequirements = [
    userContext?.trim() ? `"${userContext.trim()}"` : null,
    ...(refinementHistory || []).map((r) => `"${r}"`),
    refinement?.trim() ? `"${refinement.trim()}"` : null,
  ].filter(Boolean);

  const prevList = previousSuggestions?.length
    ? previousSuggestions.map((s, i) => `${i + 1}. ${s.item}${s.placement ? ` — ${s.placement}` : ''}`).join('\n')
    : null;

  const baselineNote = prevList
    ? `\nBASELINE FURNITURE PLAN (only modify items the user explicitly called out by name):\n${prevList}\n`
    : '';

  const requirementsBlock = allRequirements.length
    ? `════ MANDATORY REQUIREMENTS — READ BEFORE SPATIAL ANALYSIS ════
Every item below is a permanent, non-negotiable requirement. Spatial data informs HOW to satisfy them — it does NOT justify removing or ignoring any requirement.

${allRequirements.map((r, i) => `[REQ-${i + 1}] ${r}`).join('\n')}
${requiredSeats ? `
⚠ SEATING COUNT: User requires exactly ${requiredSeats} seat(s). Your suggestions MUST include exactly ${requiredSeats} distinct seating items as separate suggestion entries — a "2-pack" counts as 1 entry and is NOT acceptable. If space is tight: use folding, slim-profile, or stackable chairs. Position against walls. Do NOT solve space issues by reducing seat count.` : ''}
${baselineNote}
CONFLICT RESOLUTION:
• "too cramped" → folding/slim/stackable versions, pushed against walls
• "blocks door/walkway" → reposition to side walls, leave door clearance
• "too large" → downsize the item, do not eliminate the category

SELF-CHECK before writing JSON: verify every [REQ-N] is satisfied. Revise if not.
══════════════════════════════════════════════════════════════

`
    : '';

  const userPrompt = `${requirementsBlock}${budgetContext}
${existingContext}

The user wants a "${vibe}" aesthetic for this room.

Analyze the image directly to estimate room proportions and spatial constraints. Suggest exactly 6 specific decor items that suit the "${vibe}" vibe.

For the "spatialFit" field use exactly one of these values:
- "good"    — item fits comfortably in this space
- "tight"   — item can fit but will be snug; user should measure carefully
- "warning" — item is likely too large for this room

Rules for suggestions:
- Commit to one specific item per suggestion — one color, one material, one size. Never say "X or Y".
- productQuery must be a tight, specific retailer search string for exactly that item (e.g. "jute area rug natural 8x10" or "brass arc floor lamp mid century modern").
${budget ? `- Every item must be realistically purchasable for under $${budget} total budget across all 6 items.` : ''}

Also suggest exactly 2 wall paint colors that would complete the "${vibe}" look in this specific room. Use real paint color names from Sherwin-Williams or Benjamin Moore. Pick colors that work with the room's natural light and existing tones visible in the photo.

Respond ONLY with valid JSON — no markdown, no code fences, nothing outside the JSON:
{
  "roomAnalysis": "2–3 sentence spatial description based on the image and depth data",
  "suggestions": [
    {
      "item": "item name",
      "placement": "specific placement recommendation",
      "reason": "why it fits the ${vibe} aesthetic",
      "spatialFit": "good | tight | warning",
      "spatialNote": "specific note about whether this item's size works for this room",
      "productQuery": "specific retailer search string for this exact item",
      "priceEstimate": "realistic retail price range e.g. '~$40–80' — omit if no budget was given"
    }
  ],
  "paintColors": [
    {
      "name": "Exact paint color name as it appears in the brand's catalog",
      "hex": "#RRGGBB",
      "brand": "Sherwin-Williams or Benjamin Moore",
      "description": "One sentence on why this color works for this room and vibe"
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  });

  const block = response.content?.find((b) => b.type === 'text');
  if (!block?.text) {
    console.error('Unexpected response from model:', JSON.stringify(response));
    throw new Error('Model returned no text content');
  }
  const raw = block.text.trim();
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}
