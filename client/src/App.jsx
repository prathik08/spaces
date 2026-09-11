import { useState, useEffect } from 'react';
import ImageUpload from './components/ImageUpload';
import VibeSelector from './components/VibeSelector';
import BudgetSelector from './components/BudgetSelector';
import LoadingState from './components/LoadingState';
import DecorResults from './components/DecorResults';
import ContextInput from './components/ContextInput';
import SavedAnalyses from './components/SavedAnalyses';
import SignIn from './components/SignIn';
import { useSavedAnalyses } from './hooks/useSavedAnalyses';
import { saveImage } from './lib/storageAdapter';
import { apiFetch } from './lib/api';
import './App.css';

const LEAVES = [
  // top edge — left half
  { w: 30, top: -8,  left: '3%',   rot: -38  },
  { w: 22, top:  8,  left: '10%',  rot: -58  },
  { w: 18, top: -4,  left: '17%',  rot: -22  },
  { w: 25, top: 14,  left: '24%',  rot: -44  },
  { w: 16, top:  0,  left: '31%',  rot: -16  },
  { w: 14, top: -6,  left: '42%',  rot:  20  },
  // top edge — right half
  { w: 30, top: -8,  right: '3%',  rot:  38  },
  { w: 22, top:  8,  right: '10%', rot:  58  },
  { w: 18, top: -4,  right: '17%', rot:  22  },
  { w: 25, top: 14,  right: '24%', rot:  44  },
  { w: 16, top:  0,  right: '31%', rot:  16  },
  { w: 14, top: -6,  right: '42%', rot: -20  },
  // mid sides
  { w: 22, top: '38%', left: '1%',   rot: -82  },
  { w: 17, top: '62%', left: '5%',   rot: -55  },
  { w: 22, top: '38%', right: '1%',  rot:  82  },
  { w: 17, top: '62%', right: '5%',  rot:  55  },
  // bottom edge — left half
  { w: 28, bottom: -6, left: '5%',   rot: -142 },
  { w: 20, bottom:  8, left: '13%',  rot: -164 },
  { w: 24, bottom: -2, left: '22%',  rot: -126 },
  { w: 16, bottom:  4, left: '30%',  rot: -150 },
  // bottom edge — right half
  { w: 28, bottom: -6, right: '5%',  rot:  142 },
  { w: 20, bottom:  8, right: '13%', rot:  164 },
  { w: 24, bottom: -2, right: '22%', rot:  126 },
  { w: 16, bottom:  4, right: '30%', rot:  150 },
];

const leafStyle = ({ w, top, bottom, left, right, rot }) => ({
  position: 'absolute',
  pointerEvents: 'none',
  width: w,
  ...(top    !== undefined ? { top:    typeof top    === 'number' ? `${top}px`    : top    } : {}),
  ...(bottom !== undefined ? { bottom: typeof bottom === 'number' ? `${bottom}px` : bottom } : {}),
  ...(left   !== undefined ? { left } : {}),
  ...(right  !== undefined ? { right } : {}),
  transform: `rotate(${rot}deg)`,
});

export default function App() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [vibe, setVibe] = useState('');
  const [detectedItems, setDetectedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [detectingItems, setDetectingItems] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [userContext, setUserContext] = useState('');
  const [budget, setBudget] = useState(undefined);
  const [stage, setStage] = useState('input');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [currentSaveId, setCurrentSaveId] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [authError, setAuthError] = useState(false);
  const { saves, save, update, remove } = useSavedAnalyses(!!user);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('auth_error')) {
      setAuthError(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    apiFetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  const handleSubmit = async () => {
    if (!image || !vibe) return;

    setStage('loading');
    setError(null);

    const formData = new FormData();
    formData.append('image', image);
    formData.append('vibe', vibe);
    if (selectedItems.length) formData.append('existingFurniture', selectedItems.join(', '));
    if (userContext.trim()) formData.append('userContext', userContext.trim());
    if (typeof budget === 'number') formData.append('budget', budget);

    try {
      const res = await apiFetch('/api/analyze', { method: 'POST', body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const analysisData = await res.json();

      // Fetch products and merge into suggestions before showing results
      let prodResults = analysisData.suggestions.map(() => ({ product: null, shopLinks: [] }));
      try {
        const prodRes = await apiFetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestions: analysisData.suggestions.map((s) => ({
              item: s.item,
              productQuery: s.productQuery,
            })),
            budget: typeof budget === 'number' ? budget : undefined,
          }),
        });
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          prodResults = prodData.results ?? prodResults;
        }
      } catch (_) {}

      const mergedResults = {
        ...analysisData,
        suggestions: analysisData.suggestions.map((s, i) => ({
          ...s,
          product: prodResults[i]?.product ?? null,
          shopLinks: prodResults[i]?.shopLinks ?? [],
        })),
      };

      setResults(mergedResults);
      setStage('results');

      const imageUrl = await saveImage(imagePreview, { maxWidth: 1400, quality: 0.85 });
      const id = await save({ vibe, budget, imageUrl, results: mergedResults, vizUrl: null });
      setCurrentSaveId(id);
    } catch (err) {
      setError(err.message);
      setStage('input');
    }
  };

  const handleVizGenerated = async (vizImage) => {
    if (!currentSaveId) return;
    const vizUrl = await saveImage(vizImage, { maxWidth: 1400, quality: 0.85 });
    await update(currentSaveId, { vizUrl });
  };

  const handleReset = () => {
    setImage(null);
    setImagePreview(null);
    setVibe('');
    setDetectedItems([]);
    setSelectedItems([]);
    setCustomInput('');
    setShowCustomInput(false);
    setBudget(undefined);
    setUserContext('');
    setStage('input');
    setResults(null);
    setError(null);
    setCurrentSaveId(null);
  };

  // Keep image + context, clear vibe/budget so user can try a different direction
  const handleReanalyze = () => {
    setVibe('');
    setBudget(undefined);
    setStage('input');
    setResults(null);
    setError(null);
    setCurrentSaveId(null);
  };

  return (
    <div className="app">
      <header className="header">
        {LEAVES.map((leaf, i) => (
          <svg key={i} style={leafStyle(leaf)} viewBox="0 0 18 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 1C18 12 18 32 9 43C0 32 0 12 9 1Z" fill="rgba(88,112,64,0.32)" stroke="rgba(88,112,64,0.52)" strokeWidth="0.9"/>
            <line x1="9" y1="2" x2="9" y2="42" stroke="rgba(88,112,64,0.38)" strokeWidth="0.65"/>
          </svg>
        ))}
        <div className="header-title-wrap">
          <h1>Spaces</h1>
        </div>
        <p>Upload your room, pick a vibe, get spatially-aware design suggestions</p>

        {user && (
          <div className="user-badge">
            <img src={user.avatarUrl} alt="" />
            <span>{user.login}</span>
            <button onClick={handleLogout}>Sign out</button>
          </div>
        )}
      </header>

      <main className="main">
        {user === null && <SignIn error={authError} />}

        {user && stage === 'input' && (
          <>
            <ImageUpload
              imagePreview={imagePreview}
              onImageChange={async (file, preview) => {
                setImage(file);
                setImagePreview(preview);
                setDetectedItems([]);
                setSelectedItems([]);
                setDetectingItems(true);
                try {
                  const fd = new FormData();
                  fd.append('image', file);
                  const res = await apiFetch('/api/detect-items', { method: 'POST', body: fd });
                  if (res.ok) {
                    const data = await res.json();
                    setDetectedItems(data.items || []);
                  }
                } catch (_) {}
                setDetectingItems(false);
              }}
            />

            {image && (
              <div className="existing-wrap">
                <div className="section-label">
                  02 — What are you keeping?
                  {selectedItems.length > 0 && (
                    <span className="keeping-count"> · {selectedItems.length} selected</span>
                  )}
                </div>
                {detectingItems ? (
                  <p className="detecting-text">Scanning your room…</p>
                ) : (
                  <>
                    <div className="item-bubbles">
                      {detectedItems.map((item) => (
                        <button
                          key={item}
                          className={`item-bubble ${selectedItems.includes(item) ? 'selected' : ''}`}
                          onClick={() =>
                            setSelectedItems((prev) =>
                              prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
                            )
                          }
                        >
                          {item}
                        </button>
                      ))}
                      <button
                        className={`item-bubble other-bubble ${showCustomInput ? 'selected' : ''}`}
                        onClick={() => setShowCustomInput((v) => !v)}
                      >
                        + Other
                      </button>
                    </div>
                    {showCustomInput && (
                      <input
                        className="custom-item-input"
                        placeholder="e.g. vintage mirror, record player…"
                        value={customInput}
                        autoFocus
                        onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customInput.trim()) {
                            const val = customInput.trim();
                            setDetectedItems((prev) => prev.includes(val) ? prev : [...prev, val]);
                            setSelectedItems((prev) => prev.includes(val) ? prev : [...prev, val]);
                            setCustomInput('');
                            setShowCustomInput(false);
                          }
                          if (e.key === 'Escape') {
                            setCustomInput('');
                            setShowCustomInput(false);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            <ContextInput value={userContext} onChange={setUserContext} />
            <VibeSelector vibe={vibe} onVibeChange={setVibe} />
            <BudgetSelector budget={budget} onBudgetChange={setBudget} />
            {error && <div className="error-box">Error: {error}</div>}
            <button
              className="analyze-btn"
              onClick={handleSubmit}
              disabled={!image || !vibe}
            >
              Analyze My Room →
            </button>
          </>
        )}

        {user && stage === 'loading' && <LoadingState />}

        {user && stage === 'results' && results && (
          <DecorResults
            results={results}
            imagePreview={imagePreview}
            image={image}
            vibe={vibe}
            budget={budget}
            onReset={handleReset}
            onReanalyze={handleReanalyze}
            onVizGenerated={handleVizGenerated}
          />
        )}

        {user && <SavedAnalyses saves={saves} onRemove={remove} onUpdate={update} />}
      </main>
    </div>
  );
}
