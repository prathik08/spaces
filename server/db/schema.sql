-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- to create the table saved analyses live in.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  owner text not null,              -- GitHub login of the signed-in user
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  vibe text,
  budget integer,
  image_url text,
  viz_url text,
  results jsonb not null,
  snapshots jsonb not null default '[]'::jsonb,
  refinement_history jsonb not null default '[]'::jsonb
);

create index if not exists analyses_owner_idx on public.analyses (owner, created_at desc);

-- The server only ever talks to this table with the service_role key, which
-- bypasses RLS — so no policies are needed. RLS is enabled anyway as a
-- safety net: if the public anon key were ever used against this table by
-- mistake, this denies all access instead of allowing it by default.
alter table public.analyses enable row level security;
