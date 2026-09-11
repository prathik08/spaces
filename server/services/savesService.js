import { createClient } from '@supabase/supabase-js';

const TABLE = 'analyses';
const MAX_PER_OWNER = 5;

let _supabase;
function supabaseClient() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

function toClientShape(row) {
  return {
    id: row.id,
    savedAt: row.created_at,
    vibe: row.vibe,
    budget: row.budget,
    imageUrl: row.image_url,
    vizUrl: row.viz_url,
    results: row.results,
    snapshots: row.snapshots,
    refinementHistory: row.refinement_history,
  };
}

export async function list(owner) {
  const { data, error } = await supabaseClient()
    .from(TABLE)
    .select('*')
    .eq('owner', owner)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(toClientShape);
}

export async function create(owner, analysis) {
  const { data, error } = await supabaseClient()
    .from(TABLE)
    .insert({
      owner,
      vibe: analysis.vibe ?? null,
      budget: analysis.budget ?? null,
      image_url: analysis.imageUrl ?? null,
      viz_url: analysis.vizUrl ?? null,
      results: analysis.results,
      snapshots: analysis.snapshots ?? [],
      refinement_history: analysis.refinementHistory ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await pruneOldest(owner);
  return toClientShape(data);
}

// Cap saves per user at MAX_PER_OWNER, matching the old localStorage limit.
async function pruneOldest(owner) {
  const { data, error } = await supabaseClient()
    .from(TABLE)
    .select('id')
    .eq('owner', owner)
    .order('created_at', { ascending: false })
    .range(MAX_PER_OWNER, 1000);
  if (error || !data?.length) return;
  await supabaseClient().from(TABLE).delete().in('id', data.map((r) => r.id));
}

const PATCH_FIELDS = {
  vizUrl: 'viz_url',
  results: 'results',
  snapshots: 'snapshots',
  refinementHistory: 'refinement_history',
};

export async function update(owner, id, patch) {
  const row = {};
  for (const [key, column] of Object.entries(PATCH_FIELDS)) {
    if (key in patch) row[column] = patch[key];
  }
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabaseClient()
    .from(TABLE)
    .update(row)
    .eq('id', id)
    .eq('owner', owner) // ownership check — can't patch someone else's row
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toClientShape(data);
}

export async function remove(owner, id) {
  const { error } = await supabaseClient().from(TABLE).delete().eq('id', id).eq('owner', owner);
  if (error) throw new Error(error.message);
}
