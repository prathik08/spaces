import { useState, useEffect, useCallback } from 'react';
import * as store from '../lib/analysisStore';

// `enabled` should track whether there's a signed-in session — the /api/saves
// routes require auth, so there's nothing to fetch (and nothing to migrate)
// until then.
export function useSavedAnalyses(enabled) {
  const [saves, setSaves] = useState([]);

  const refresh = useCallback(async () => {
    try {
      setSaves(await store.list());
    } catch {
      // leave saves as-is; the UI just won't reflect a failed refresh
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSaves([]);
      return;
    }
    store.migrateLegacySaves().finally(refresh);
  }, [enabled, refresh]);

  const save = async (analysis) => {
    const id = await store.save(analysis);
    await refresh();
    return id;
  };

  const update = async (id, patch) => {
    await store.update(id, patch);
    await refresh();
  };

  const remove = async (id) => {
    await store.remove(id);
    await refresh();
  };

  return { saves, save, update, remove };
}
