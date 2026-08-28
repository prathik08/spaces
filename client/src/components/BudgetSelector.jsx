import { useState } from 'react';

const PRESETS = [
  { label: '$50',      value: 50  },
  { label: '$150',     value: 150 },
  { label: '$500',     value: 500 },
  { label: 'No limit', value: null },
];

export default function BudgetSelector({ budget, onBudgetChange }) {
  const [showSlider, setShowSlider] = useState(false);
  const [sliderValue, setSliderValue] = useState(250);

  return (
    <div className="budget-wrap">
      <div className="section-label">05 — Total budget (optional)</div>
      <div className="budget-grid">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`budget-btn ${!showSlider && budget === p.value ? 'selected' : ''}`}
            onClick={() => { setShowSlider(false); onBudgetChange(p.value); }}
          >
            {p.label}
          </button>
        ))}
        <button
          className={`budget-btn ${showSlider ? 'selected' : ''}`}
          onClick={() => { setShowSlider(true); onBudgetChange(sliderValue); }}
        >
          Other
        </button>
      </div>

      {showSlider && (
        <div className="budget-slider-wrap">
          <div className="budget-slider-value">${sliderValue.toLocaleString()}</div>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={sliderValue}
            className="budget-slider"
            onChange={(e) => {
              const v = Number(e.target.value);
              setSliderValue(v);
              onBudgetChange(v);
            }}
          />
          <div className="budget-slider-labels">
            <span>$50</span>
            <span>$2,000</span>
          </div>
        </div>
      )}
    </div>
  );
}
