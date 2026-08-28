const CHIPS = [
  'Turn into a reading nook',
  'Create a home office',
  'Add more seating',
  'Make it cozy and inviting',
  'Maximize storage',
  'Create a dining space',
  'Entertainment and TV area',
  'Work-from-home setup',
  'Meditation or yoga corner',
  'Pet-friendly space',
];

export default function ContextInput({ value, onChange }) {
  return (
    <div className="context-wrap">
      <div className="section-label">03 — What's your vision? (optional)</div>
      <textarea
        className="context-textarea"
        placeholder="Describe what you want from this space — e.g. turn it into a cozy reading corner, make it work-from-home ready…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
      <div className="context-chips">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            className={`context-chip ${value === chip ? 'selected' : ''}`}
            onClick={() => onChange(value === chip ? '' : chip)}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
