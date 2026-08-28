import { useEffect } from 'react';

export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>×</button>
      <img
        src={src}
        alt={alt || ''}
        className="lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
