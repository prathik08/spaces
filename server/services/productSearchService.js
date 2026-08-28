const SHOPPING_URL = 'https://serpapi.com/search.json';

function extractAsin(url) {
  if (!url) return null;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/);
  return match ? match[1] : null;
}

function isMultiSet(title) {
  return /\bset\s+of\s+[2-9]\b|\bpack\s+of\s+[2-9]\b|\b[2-9][- ]?pack\b/i.test(title || '');
}

function formatItem(item) {
  if (!item) return null;
  return {
    title: item.title,
    price: item.price,
    imageUrl: item.thumbnail,
    url: item.link || item.product_link || null,
    retailer: item.source || null,
    asin: extractAsin(item.link),
  };
}

async function searchProductRaw(query) {
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: process.env.SERPAPI_KEY,
    num: 5,
    gl: 'us',
    hl: 'en',
  });

  const res = await fetch(`${SHOPPING_URL}?${params}`);
  if (!res.ok) throw new Error(`Serpapi ${res.status}`);

  const data = await res.json();
  return data.shopping_results || [];
}

function pickBest(items) {
  if (!items.length) return null;
  // Prefer singles with thumbnail+price, then sets, then anything with a thumbnail
  const withThumb = items.filter((r) => r.thumbnail);
  const withBoth = withThumb.filter((r) => r.price);
  const singles = withBoth.filter((r) => !isMultiSet(r.title));
  const picked = singles[0] || withBoth[0] || withThumb[0] || null;
  return picked ? formatItem(picked) : null;
}

export async function searchProduct(query) {
  let items = await searchProductRaw(query);
  console.log(`[products] query="${query}" → ${items.length} results, ${items.filter(r => r.thumbnail).length} with thumbnail`);

  let result = pickBest(items);
  if (result) return result;

  // Fallback: simplify to first 3 meaningful words
  const simplified = query.split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join(' ');
  if (simplified && simplified !== query) {
    console.log(`[products] fallback query="${simplified}"`);
    items = await searchProductRaw(simplified);
    console.log(`[products] fallback → ${items.length} results, ${items.filter(r => r.thumbnail).length} with thumbnail`);
    result = pickBest(items);
  }
  return result;
}
