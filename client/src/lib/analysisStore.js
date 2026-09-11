/**
 * analysisStore — all analysis persistence lives here.
 *
 * Analysis shape:
 *   { id, savedAt, vibe, budget, imageUrl, vizUrl, results, snapshots, refinementHistory }
 *
 *   imageUrl / vizUrl are opaque URL strings — compressed data URLs stored in the DB row.
 *   results shape: { roomAnalysis, suggestions[], paintColors[] }
 *
 * Backed by the server's /api/saves routes (server/services/savesService.js),
 * which store each row in Supabase Postgres keyed by the signed-in GitHub
 * login. Requires an authenticated session — call sites should only use this
 * once signed in.
 */

import { apiFetch } from './api';

const LEGACY_KEY = 'spaces_saved';

function readLegacy() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_KEY)) || [];
    // One-time rename from even older field names, carried over from the
    // pre-server localStorage schema.
    return raw.map((entry) => {
      const out = { ...entry };
      if (!out.imageUrl && out.imagePreview) { out.imageUrl = out.imagePreview; delete out.imagePreview; }
      if (!out.vizUrl && out.vizImage) { out.vizUrl = out.vizImage; delete out.vizImage; }
      return out;
    });
  } catch {
    return [];
  }
}

export async function list() {
  const res = await apiFetch('/api/saves');
  if (!res.ok) throw new Error('Failed to load saved analyses');
  const { saves } = await res.json();
  return saves;
}

export async function save(analysis) {
  const res = await apiFetch('/api/saves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analysis),
  });
  if (!res.ok) throw new Error('Failed to save analysis');
  const { save: created } = await res.json();
  return created.id;
}

export async function update(id, patch) {
  const res = await apiFetch(`/api/saves/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update saved analysis');
}

export async function remove(id) {
  const res = await apiFetch(`/api/saves/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete saved analysis');
}

// One-time migration for anyone who had saves from before server-side
// storage existed: push what's in localStorage into their account, then
// clear it so this only ever runs once per browser.
export async function migrateLegacySaves() {
  const legacy = readLegacy();
  if (!legacy.length) return;

  // Oldest first, so re-saving through save() (which prepends) ends up in
  // the same newest-first order they were in before.
  for (const entry of [...legacy].reverse()) {
    await save({
      vibe: entry.vibe,
      budget: entry.budget,
      imageUrl: entry.imageUrl,
      vizUrl: entry.vizUrl,
      results: entry.results,
      snapshots: entry.snapshots,
      refinementHistory: entry.refinementHistory,
    }).catch(() => {}); // best-effort — one bad legacy row shouldn't block the rest
  }
  localStorage.removeItem(LEGACY_KEY);
}
