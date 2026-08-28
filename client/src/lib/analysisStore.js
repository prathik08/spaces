/**
 * analysisStore — all analysis persistence lives here.
 *
 * Analysis shape:
 *   { id, savedAt, vibe, budget, imageUrl, vizUrl, results }
 *
 *   imageUrl / vizUrl are opaque URL strings — data URLs today, Supabase Storage URLs tomorrow.
 *   results shape: { roomAnalysis, suggestions[], paintColors[] }
 *
 * Today: localStorage.
 * Supabase swap: replace read/write with Supabase Postgres queries.
 *   list()   → supabase.from('analyses').select('*').order('saved_at', { ascending: false })
 *   save()   → supabase.from('analyses').insert({ ...entry })
 *   update() → supabase.from('analyses').update(patch).eq('id', id)
 *   remove() → supabase.from('analyses').delete().eq('id', id)
 *   Make each function async and add `await` at the call sites in useSavedAnalyses.
 */

const KEY = 'spaces_saved';
const MAX = 5;

function migrate(entry) {
  // One-time rename from old field names to current schema
  const out = { ...entry };
  if (!out.imageUrl && out.imagePreview) { out.imageUrl = out.imagePreview; delete out.imagePreview; }
  if (!out.vizUrl   && out.vizImage)     { out.vizUrl   = out.vizImage;     delete out.vizImage;     }
  return out;
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || [];
    const migrated = raw.map(migrate);
    if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
      localStorage.setItem(KEY, JSON.stringify(migrated));
    }
    return migrated;
  }
  catch { return []; }
}

function write(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); }
  catch { console.warn('analysisStore: localStorage quota exceeded — save skipped'); }
}

export function list() {
  return read();
}

export function save(analysis) {
  const id = Date.now();
  const entry = { id, savedAt: new Date().toISOString(), ...analysis };
  write([entry, ...read()].slice(0, MAX));
  return id;
}

export function update(id, patch) {
  write(read().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function remove(id) {
  write(read().filter((s) => s.id !== id));
}
