import { useState } from 'react';
import Lightbox from './Lightbox';
import { apiFetch } from '../lib/api';

const BADGE = {
  good:    { label: '✓ Fits well',  cls: 'good'    },
  tight:   { label: '⚠ Tight fit', cls: 'tight'   },
  warning: { label: '✗ Too large', cls: 'warning' },
};

export default function DecorResults({ results, imagePreview, image, vibe, budget, onReset, onReanalyze, onVizGenerated }) {
  const [vizImage, setVizImage] = useState(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [vizError, setVizError] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const handleVisualize = async () => {
    if (!image) return;
    setVizLoading(true);
    setVizError(null);

    const formData = new FormData();
    formData.append('image', image);
    formData.append('vibe', vibe);
    // suggestions include embedded product data; visualizationService uses product images automatically
    formData.append('suggestions', JSON.stringify(results.suggestions));

    try {
      const res = await apiFetch('/api/visualize', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setVizImage(data.image);
      onVizGenerated?.(data.image);
    } catch (err) {
      setVizError(err.message);
    } finally {
      setVizLoading(false);
    }
  };

  return (
    <div>
      <div className="results-banner">
        {imagePreview && (
          <img
            src={imagePreview}
            alt="Your room"
            className="results-thumb"
            style={{ cursor: 'zoom-in' }}
            onClick={() => setLightbox(imagePreview)}
          />
        )}
        <div className="results-meta">
          <div className="results-tags">
            <span className="vibe-tag">{vibe}</span>
            {typeof budget === 'number' && (
              <span className="budget-tag">${budget.toLocaleString()} total budget</span>
            )}
          </div>
          <h2>Your Decor Suggestions</h2>
          <p className="results-analysis">{results.roomAnalysis}</p>
        </div>
      </div>

      {/* Visualization */}
      <div className="viz-section">
        {!vizImage && !vizLoading && (
          <button className="viz-btn" onClick={handleVisualize}>
            Generate room visualization →
          </button>
        )}
        {vizLoading && (
          <div className="viz-loading">
            <div className="spinner" />
            <p>Generating visualization — this takes about 30–60 seconds</p>
          </div>
        )}
        {vizError && (
          <div className="error-box" style={{ marginBottom: '1.5rem' }}>
            Visualization failed: {vizError}
            <button className="viz-retry" onClick={handleVisualize}>Retry</button>
          </div>
        )}
        {vizImage && (
          <div className="viz-comparison">
            <div className="viz-panel">
              <span className="viz-label">Before</span>
              <img src={imagePreview} alt="Original room" className="viz-img"
                style={{ cursor: 'zoom-in' }} onClick={() => setLightbox(imagePreview)} />
            </div>
            <div className="viz-panel">
              <span className="viz-label">After</span>
              <img src={vizImage} alt="Visualized room" className="viz-img"
                style={{ cursor: 'zoom-in' }} onClick={() => setLightbox(vizImage)} />
            </div>
          </div>
        )}
      </div>

      <div className="section-label">Suggestions</div>
      <div className="suggestions-grid">
        {results.suggestions.map((s, i) => {
          const fit = BADGE[s.spatialFit] || BADGE.good;
          return (
            <div key={i} className="suggestion-card">
              <div className="card-top">
                <h3>{s.item}</h3>
                <span className={`badge ${fit.cls}`}>{fit.label}</span>
              </div>
              <div className="placement">{s.placement}</div>
              <div className="reason">{s.reason}</div>
              <div className={`spatial-note ${fit.cls}`}>{s.spatialNote}</div>

              {s.product ? (
                <a href={s.product.url} target="_blank" rel="noopener noreferrer" className="product-card">
                  {s.product.imageUrl && (
                    <img src={s.product.imageUrl} alt={s.product.title} className="product-img" />
                  )}
                  <div className="product-info">
                    <span className="product-title">{s.product.title}</span>
                    {s.product.price && <span className="product-price">{s.product.price}</span>}
                    {s.product.retailer && <span className="product-retailer">{s.product.retailer}</span>}
                  </div>
                  <span className="product-arrow">→</span>
                </a>
              ) : s.shopLinks?.length > 0 ? (
                <div className="shop-links">
                  {s.shopLinks.map((link) => (
                    <a key={link.retailer} href={link.url} target="_blank" rel="noopener noreferrer" className="shop-link">
                      {link.retailer} →
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="results-footer">
        <button className="reset-btn" onClick={onReset}>← New room</button>
        <button className="reset-btn" onClick={onReanalyze}>Try a different vibe or budget →</button>
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
