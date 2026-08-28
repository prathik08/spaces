import { useState } from 'react';
import * as store from '../lib/analysisStore';

export function useSavedAnalyses() {
  const [saves, setSaves] = useState(() => store.list());

  const refresh = () => setSaves(store.list());

  const save = (analysis) => {
    const id = store.save(analysis);
    refresh();
    return id;
  };

  const update = (id, patch) => {
    store.update(id, patch);
    refresh();
  };

  const remove = (id) => {
    store.remove(id);
    refresh();
  };

  return { saves, save, update, remove };
}
