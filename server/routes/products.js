import express from 'express';
import { searchProduct } from '../services/productSearchService.js';

const router = express.Router();


function buildShopLinks(productQuery, item, budget) {
  const q = encodeURIComponent(productQuery || item);
  const amazonUrl = budget
    ? `https://www.amazon.com/s?k=${q}&rh=p_36%3A1-${budget * 100}`
    : `https://www.amazon.com/s?k=${q}`;
  const targetUrl = budget
    ? `https://www.target.com/s?searchTerm=${q}&facetedValue=price_range%5B0+TO+${budget}%5D`
    : `https://www.target.com/s?searchTerm=${q}`;
  return [
    { retailer: 'Amazon',  url: amazonUrl },
    { retailer: 'Wayfair', url: `https://www.wayfair.com/keyword.php?keyword=${q}` },
    { retailer: 'Target',  url: targetUrl },
  ];
}

// POST /api/products
// { suggestions: [{ item, productQuery, priceEstimate }], budget?: number }
router.post('/products', async (req, res) => {
  try {
    const { suggestions, budget } = req.body;
    if (!Array.isArray(suggestions)) {
      return res.status(400).json({ error: 'suggestions must be an array' });
    }

    const results = await Promise.all(
      suggestions.map(async (s) => {
        const product = await searchProduct(s.productQuery).catch(() => null);
        // Show any product SerpAPI returned with an image — SerpAPI already handles search relevance.
        // Only fall back to shop links when the search returned nothing at all.
        const hasImage = Boolean(product?.imageUrl);
        return {
          product: hasImage ? product : null,
          shopLinks: hasImage ? [] : buildShopLinks(s.productQuery, s.item, budget ?? null),
        };
      })
    );

    res.json({ results });
  } catch (err) {
    console.error('Products error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch products' });
  }
});

export default router;
