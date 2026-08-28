const VIBES = [
  { id: 'Cozy',         emoji: '🕯️',  desc: 'Warm & inviting'      },
  { id: 'Minimalist',   emoji: '◻️',  desc: 'Clean & simple'       },
  { id: 'Boho',         emoji: '🌿',  desc: 'Eclectic & natural'   },
  { id: 'Dark Academia',emoji: '📚',  desc: 'Moody & literary'     },
  { id: 'Coastal',      emoji: '🌊',  desc: 'Breezy & relaxed'     },
  { id: 'Industrial',   emoji: '⚙️',  desc: 'Raw & urban'          },
  { id: 'Y2K',          emoji: '💿',  desc: 'Retro-futuristic'     },
  { id: 'Cottagecore',  emoji: '🌸',  desc: 'Rustic & floral'      },
  { id: 'Japandi',      emoji: '🎋',  desc: 'Zen & functional'     },
  { id: 'Maximalist',   emoji: '✨',  desc: 'Bold & layered'       },
];

export default function VibeSelector({ vibe, onVibeChange }) {
  return (
    <div className="vibe-wrap">
      <div className="section-label">04 — Pick your vibe</div>
      <div className="vibe-grid">
        {VIBES.map((v) => (
          <div
            key={v.id}
            className={`vibe-card ${vibe === v.id ? 'selected' : ''}`}
            onClick={() => onVibeChange(v.id)}
          >
            <span className="vibe-emoji">{v.emoji}</span>
            <div className="vibe-name">{v.id}</div>
            <div className="vibe-desc">{v.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
