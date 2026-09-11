import { useState, useEffect } from 'react';
import { saveImage } from '../lib/storageAdapter';
import { apiFetch } from '../lib/api';
import Lightbox from './Lightbox';

const BADGE = {
  good:    { label: 'Fits well', cls: 'good'    },
  tight:   { label: 'Tight fit', cls: 'tight'   },
  warning: { label: 'Too large', cls: 'warning' },
};

function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function dataUrlToFile(dataUrl, filename = 'room.jpg') {
  if (!dataUrl || !dataUrl.includes(',')) {
    throw new Error('Image data missing — try re-running this analysis');
  }
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

/* ── Full analysis view ──────────────────────────── */
function AnalysisView({ entry, onClose, onVizGenerated, startInRefine }) {
  const snapshots = entry.snapshots || [];
  const totalVersions = snapshots.length + 1; // snapshots = past versions, +1 = current
  const [viewIndex, setViewIndex] = useState(snapshots.length); // default to latest
  const [vizLoading, setVizLoading] = useState(false);
  const [vizStep, setVizStep] = useState('');
  const [vizError, setVizError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [refineInput, setRefineInput] = useState('');
  const [refineOpen, setRefineOpen] = useState(!!startInRefine);

  // Jump to latest whenever a new refinement lands
  useEffect(() => {
    setViewIndex(snapshots.length);
  }, [snapshots.length]);

  const isLatest = viewIndex === snapshots.length;
  const activeVizUrl = isLatest ? entry.vizUrl : snapshots[viewIndex].vizUrl;
  const activeResults = isLatest ? entry.results : snapshots[viewIndex].results;

  const versionLabel = (i) => {
    if (i === 0 && snapshots.length > 0) return 'Original';
    if (i === snapshots.length) return snapshots.length > 0 ? 'Latest' : 'Original';
    const feedbackLabel = entry.refinementHistory?.[i - 1];
    return feedbackLabel
      ? `Refinement ${i}: "${feedbackLabel.length > 28 ? feedbackLabel.slice(0, 28) + '…' : feedbackLabel}"`
      : `Refinement ${i}`;
  };

  // Initial visualization — uses existing suggestions, no re-analysis
  const runVisualize = async () => {
    setVizLoading(true);
    setVizStep('Generating visualization — this takes about 30–60 seconds');
    setVizError(null);
    try {
      const file = dataUrlToFile(entry.imageUrl);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('vibe', entry.vibe);
      formData.append('suggestions', JSON.stringify(entry.results.suggestions));

      const res = await apiFetch('/api/visualize', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      await onVizGenerated(entry.id, data.image);
    } catch (err) {
      setVizError(err.message);
    } finally {
      setVizLoading(false);
      setVizStep('');
    }
  };

  // Refinement — full re-analyze with feedback → products → visualization
  const runRefine = async (refinement) => {
    setVizLoading(true);
    setVizError(null);
    try {
      const file = dataUrlToFile(entry.imageUrl);

      // Step 1: Re-analyze with user feedback
      setVizStep('Re-analyzing your room with your feedback…');
      const analyzeForm = new FormData();
      analyzeForm.append('image', file);
      analyzeForm.append('vibe', entry.vibe);
      if (entry.budget) analyzeForm.append('budget', String(entry.budget));
      analyzeForm.append('refinement', refinement.trim());
      analyzeForm.append('previousSuggestions', JSON.stringify(entry.results.suggestions));
      if (entry.refinementHistory?.length) {
        analyzeForm.append('refinementHistory', JSON.stringify(entry.refinementHistory));
      }

      const analyzeRes = await apiFetch('/api/analyze', { method: 'POST', body: analyzeForm });
      if (!analyzeRes.ok) {
        const data = await analyzeRes.json().catch(() => ({}));
        throw new Error(data.error || 'Re-analysis failed');
      }
      const newResults = await analyzeRes.json();

      // Step 2: Fetch products for new suggestions and merge
      setVizStep('Finding matching products…');
      let prodResults = newResults.suggestions.map(() => ({ product: null, shopLinks: [] }));
      try {
        const prodRes = await apiFetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestions: newResults.suggestions.map((s) => ({
              item: s.item,
              productQuery: s.productQuery,
            })),
            budget: entry.budget ?? undefined,
          }),
        });
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          prodResults = prodData.results ?? prodResults;
        }
      } catch (_) {}

      const mergedResults = {
        ...newResults,
        suggestions: newResults.suggestions.map((s, i) => ({
          ...s,
          product: prodResults[i]?.product ?? null,
          shopLinks: prodResults[i]?.shopLinks ?? [],
        })),
      };

      // Step 3: Generate visualization with merged suggestions (includes product images)
      setVizStep('Generating new visualization — this takes about 30–60 seconds');
      const vizForm = new FormData();
      vizForm.append('image', file);
      vizForm.append('vibe', entry.vibe);
      vizForm.append('suggestions', JSON.stringify(mergedResults.suggestions));

      const vizRes = await apiFetch('/api/visualize', { method: 'POST', body: vizForm });
      if (!vizRes.ok) {
        const data = await vizRes.json().catch(() => ({}));
        throw new Error(data.error || 'Visualization failed');
      }
      const vizData = await vizRes.json();

      await onVizGenerated(entry.id, vizData.image, mergedResults, refinement.trim());
      setRefineInput('');
      setRefineOpen(false);
    } catch (err) {
      setVizError(err.message);
    } finally {
      setVizLoading(false);
      setVizStep('');
    }
  };

  return (
    <div className="compare-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="compare-modal analysis-modal">
        <div className="compare-modal-header">
          <div className="analysis-modal-title">
            <div className="saved-tags">
              <span className="vibe-tag">{entry.vibe}</span>
              {typeof entry.budget === 'number' && (
                <span className="budget-tag">${entry.budget.toLocaleString()}</span>
              )}
            </div>
            <span className="saved-date" style={{ marginTop: '0.2rem' }}>{fmt(entry.savedAt)}</span>
          </div>
          <button className="compare-close" onClick={onClose}>×</button>
        </div>

        <div className="analysis-modal-body">
          {/* Room image or before/after */}
          {activeVizUrl ? (
            <div className="viz-comparison" style={{ margin: '0 0 0' }}>
              <div className="viz-panel">
                <span className="viz-label">Before</span>
                <img
                  src={entry.imageUrl}
                  alt="Original room"
                  className="viz-img"
                  style={{ cursor: 'zoom-in' }}
                  onClick={() => setLightbox(entry.imageUrl)}
                />
              </div>
              <div className="viz-panel">
                <span className="viz-label">After</span>
                <img
                  src={activeVizUrl}
                  alt="Visualized room"
                  className="viz-img"
                  style={{ cursor: 'zoom-in' }}
                  onClick={() => setLightbox(activeVizUrl)}
                />
              </div>
            </div>
          ) : (
            <img
              src={entry.imageUrl}
              alt="Room"
              className="analysis-room-img"
              style={{ cursor: 'zoom-in', marginBottom: 0 }}
              onClick={() => setLightbox(entry.imageUrl)}
            />
          )}

          {/* Version navigation */}
          {totalVersions > 1 && (
            <div className="history-nav">
              <button
                className="history-arrow"
                onClick={() => setViewIndex((v) => Math.max(0, v - 1))}
                disabled={viewIndex === 0}
              >
                ←
              </button>
              <span className="history-label">{versionLabel(viewIndex)}</span>
              <span className="history-count">{viewIndex + 1} / {totalVersions}</span>
              <button
                className="history-arrow"
                onClick={() => setViewIndex((v) => Math.min(snapshots.length, v + 1))}
                disabled={isLatest}
              >
                →
              </button>
            </div>
          )}

          {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

          {/* Visualization / refine section — only on latest version */}
          {isLatest && (
            <div className="viz-section" style={{ marginBottom: '1.5rem' }}>
              {vizLoading && (
                <div className="viz-loading">
                  <div className="spinner" />
                  <p>{vizStep}</p>
                </div>
              )}
              {vizError && !vizLoading && (
                <div className="error-box">
                  {vizError}
                  <button className="viz-retry" onClick={runVisualize}>Retry</button>
                </div>
              )}
              {!vizLoading && !entry.vizUrl && !vizError && (
                <button className="viz-btn" onClick={runVisualize}>
                  Generate room visualization →
                </button>
              )}
              {!vizLoading && entry.vizUrl && !refineOpen && (
                <button className="refine-toggle-btn" onClick={() => setRefineOpen(true)}>
                  Refine this visualization →
                </button>
              )}
              {!vizLoading && refineOpen && (
                <div className="refine-panel">
                  <textarea
                    className="refine-textarea"
                    placeholder="What would you like to change? e.g. I don't like the table, make it less cramped, swap the rug for something darker…"
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <button
                    className="refine-apply-btn"
                    disabled={!refineInput.trim()}
                    onClick={() => runRefine(refineInput)}
                  >
                    Apply changes →
                  </button>
                  <button
                    className="refine-cancel-btn"
                    onClick={() => { setRefineOpen(false); setRefineInput(''); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="results-analysis" style={{ marginBottom: '1.5rem', marginTop: '1.5rem' }}>
            {activeResults.roomAnalysis}
          </p>

          {/* Suggestions */}
          <div className="section-label" style={{ marginBottom: '0.75rem' }}>Suggestions</div>
          <div className="analysis-suggestions">
            {activeResults.suggestions.map((s, i) => {
              const fit = BADGE[s.spatialFit] || BADGE.good;
              return (
                <div key={i} className="analysis-suggestion-card">
                  <div className="card-top">
                    <h3>{s.item}</h3>
                    <span className={`badge ${fit.cls}`}>{fit.label}</span>
                  </div>
                  <div className="placement">{s.placement}</div>
                  <div className="reason">{s.reason}</div>
                  {s.product ? (
                    <a
                      href={s.product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="product-card"
                    >
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
                        <a
                          key={link.retailer}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shop-link"
                        >
                          {link.retailer} →
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Paint colors */}
          {activeResults.paintColors?.length > 0 && (
            <>
              <div className="section-label" style={{ margin: '1.5rem 0 0.75rem' }}>Paint Pairings</div>
              <div className="analysis-paints">
                {activeResults.paintColors.map((c, i) => (
                  <div key={i} className="analysis-paint-card">
                    <span className="analysis-swatch" style={{ background: c.hex }} />
                    <div className="analysis-paint-info">
                      <span className="analysis-paint-name">{c.name}</span>
                      <span className="analysis-paint-brand">{c.brand}</span>
                      <span className="analysis-paint-desc">{c.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Compare panel ───────────────────────────────── */
function ComparePanel({ entry }) {
  return (
    <div className="cp-panel">
      <p className="cp-analysis">{entry.results.roomAnalysis}</p>
      <div className="section-label" style={{ margin: '0 0 0.6rem', fontSize: '0.7rem' }}>Suggestions</div>
      <div className="cp-suggestions">
        {entry.results.suggestions.map((s, i) => (
          <div key={i} className="cp-suggestion-card">
            <div className="card-top">
              <h3>{s.item}</h3>
              {s.priceEstimate && <span className="price-estimate">{s.priceEstimate}</span>}
            </div>
            {s.placement && <div className="placement">{s.placement}</div>}
            <p className="cp-reason">{s.reason}</p>
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
        ))}
      </div>

      {entry.results.paintColors?.length > 0 && (
        <>
          <div className="section-label" style={{ margin: '1.25rem 0 0.6rem', fontSize: '0.7rem' }}>Paint Pairings</div>
          <div className="cp-paints">
            {entry.results.paintColors.map((c, i) => (
              <div key={i} className="cp-paint">
                <span className="cp-swatch" style={{ background: c.hex }} />
                <div className="cp-paint-info">
                  <span className="cp-paint-name">{c.name}</span>
                  {c.brand && <span className="cp-paint-brand">{c.brand}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CompareView({ a, b, onClose }) {
  const [lightbox, setLightbox] = useState(null);

  return (
    <div className="compare-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="compare-modal">
        <div className="compare-modal-header">
          <span className="section-label" style={{ margin: 0 }}>Comparing</span>
          <button className="compare-close" onClick={onClose}>×</button>
        </div>

        {/* Full-width image strip — same pattern as view page before/after */}
        <div className="compare-images">
          {[a, b].map((entry) => (
            <div key={entry.id} className="compare-img-panel">
              <img
                src={entry.vizUrl || entry.imageUrl}
                alt="Room"
                className="compare-img"
                style={{ cursor: 'zoom-in' }}
                onClick={() => setLightbox(entry.vizUrl || entry.imageUrl)}
              />
              <div className="compare-img-caption">
                <span className="compare-img-title">
                  {entry.vibe}{typeof entry.budget === 'number' ? `, $${entry.budget.toLocaleString()}` : ''}
                </span>
                {entry.vizUrl && <span className="cp-viz-badge">viz included</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Two-column content */}
        <div className="compare-panels">
          <ComparePanel entry={a} />
          <div className="compare-divider" />
          <ComparePanel entry={b} />
        </div>
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/* ── Main component ──────────────────────────────── */
export default function SavedAnalyses({ saves, onRemove, onUpdate }) {
  const [viewingId, setViewingId] = useState(null);
  const [startInRefine, setStartInRefine] = useState(false);
  const [selectingFor, setSelectingFor] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);

  if (!saves.length) return null;

  const viewingEntry = viewingId ? saves.find((s) => s.id === viewingId) : null;

  const handleVizGenerated = async (id, vizImage, newResults, refinementText) => {
    const vizUrl = await saveImage(vizImage, { maxWidth: 1400, quality: 0.85 });
    const entry = saves.find((s) => s.id === id);
    const patch = { vizUrl };

    if (newResults) {
      // Snapshot the current state before overwriting so the user can navigate back
      const existingSnapshots = entry?.snapshots || [];
      const currentSnapshot = {
        results: entry.results,
        vizUrl: entry.vizUrl,
        label: existingSnapshots.length === 0 ? 'Original' : `Refinement ${existingSnapshots.length}`,
      };
      patch.results = newResults;
      patch.snapshots = [...existingSnapshots, currentSnapshot];
    }

    if (refinementText) {
      patch.refinementHistory = [...(entry?.refinementHistory || []), refinementText];
    }

    await onUpdate(id, patch);
  };

  const openView = (id, refine = false) => {
    setViewingId(id);
    setStartInRefine(refine);
  };

  if (viewingEntry) {
    return (
      <AnalysisView
        entry={viewingEntry}
        onClose={() => { setViewingId(null); setStartInRefine(false); }}
        onVizGenerated={handleVizGenerated}
        startInRefine={startInRefine}
      />
    );
  }

  if (compareA && compareB) {
    return (
      <CompareView
        a={compareA}
        b={compareB}
        onClose={() => { setCompareA(null); setCompareB(null); }}
      />
    );
  }

  const handleCompare = (entry) => {
    if (!selectingFor) {
      setSelectingFor(entry);
    } else {
      setCompareA(selectingFor);
      setCompareB(entry);
      setSelectingFor(null);
    }
  };

  const handleRemove = (id) => {
    if (selectingFor?.id === id) setSelectingFor(null);
    onRemove(id);
  };

  return (
    <div className="saved-section">
      <div className="section-label">
        Saved · {saves.length}/5
        {selectingFor && <span className="compare-prompt"> — pick another to compare</span>}
      </div>
      <div className="saved-list">
        {saves.map((s) => {
          const isActive = selectingFor?.id === s.id;
          const isCandidate = selectingFor && selectingFor.id !== s.id;
          return (
            <div key={s.id} className={`saved-card ${isActive ? 'saved-card--active' : ''}`}>
              <img
                src={s.imageUrl}
                alt=""
                className="saved-thumb"
                onClick={() => !selectingFor && openView(s.id)}
                style={{ cursor: selectingFor ? 'default' : 'pointer' }}
              />
              <div className="saved-info">
                <div className="saved-tags">
                  <span className="vibe-tag">{s.vibe}</span>
                  {typeof s.budget === 'number' && (
                    <span className="budget-tag">${s.budget.toLocaleString()}</span>
                  )}
                </div>
                <div className="saved-date">{fmt(s.savedAt)}</div>
                {s.vizUrl && <div className="saved-viz-dot" title="Has visualization" />}
              </div>
              <div className="saved-actions">
                {!selectingFor && (
                  <>
                    <button className="saved-btn" onClick={() => openView(s.id)}>
                      View
                    </button>
                    <button className="saved-btn" onClick={() => openView(s.id, true)}>
                      Refine
                    </button>
                  </>
                )}
                {isActive ? (
                  <button className="saved-btn saved-btn--cancel" onClick={() => setSelectingFor(null)}>
                    Cancel
                  </button>
                ) : (
                  <button
                    className={`saved-btn ${isCandidate ? 'saved-btn--select' : ''}`}
                    onClick={() => handleCompare(s)}
                  >
                    {isCandidate ? 'Select' : 'Compare'}
                  </button>
                )}
                <button
                  className="saved-btn saved-btn--remove"
                  onClick={() => handleRemove(s.id)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
