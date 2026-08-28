import { useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

function isHeicFile(file) {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

export default function ImageUpload({ imagePreview, onImageChange }) {
  const [dragOver, setDragOver] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !isHeicFile(file)) return;

    setConvertError(null);
    let processedFile = file;

    if (isHeicFile(file)) {
      setConverting(true);
      try {
        const fd = new FormData();
        fd.append('image', file);
        const res = await apiFetch('/api/convert-image', { method: 'POST', body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Conversion failed');
        }
        const blob = await res.blob();
        processedFile = new File(
          [blob],
          file.name.replace(/\.(heic|heif)$/i, '.jpg'),
          { type: 'image/jpeg' }
        );
      } catch (err) {
        setConvertError(err.message);
        setConverting(false);
        return;
      }
      setConverting(false);
    }

    const preview = URL.createObjectURL(processedFile);
    onImageChange(processedFile, preview);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="upload-wrap">
      <div className="section-label">01 — Upload your room</div>
      <div
        className={`upload-zone ${imagePreview ? 'has-image' : ''} ${dragOver ? 'drag-over' : ''}`}
        onClick={() => !converting && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {converting ? (
          <div className="upload-converting">
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            <p>Converting photo…</p>
          </div>
        ) : imagePreview ? (
          <>
            <img src={imagePreview} alt="Room preview" className="upload-preview" />
            <div className="upload-overlay">Click to change photo</div>
          </>
        ) : (
          <>
            <div className="upload-icon">↑</div>
            <h3>Drop your room photo here</h3>
            <p>or click to browse · JPG, PNG, WebP, HEIC · max 10 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
      {convertError && (
        <div className="error-box" style={{ marginTop: '0.75rem' }}>{convertError}</div>
      )}
    </div>
  );
}
