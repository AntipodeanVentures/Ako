-- Ako - what the learner already knows, as fields on their map.
--
-- prior_fields: the fields and areas a learner brought with them (from a
-- CV, a certificate, or their own words), each with the level they claim on
-- the ladder and the evidence for it. A field can be verified with a short
-- check from memory, which sets verified_level; until then it is a claim.
-- Lessons draw comparisons from these, the planner skips what a verified
-- field covers, and the map of what the learner knows draws them as nodes
-- that new learning attaches to.

create table if not exists public.prior_fields (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  field text not null,
  area text not null default '',
  level text not null default 's2',
  basis text not null default '',
  source text not null default 'typed',
  verified_level text,
  verified_at timestamptz,
  verified jsonb,
  evidence jsonb not null default '{"ok":0,"n":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prior_fields_profile on public.prior_fields (profile_id);
create unique index if not exists idx_prior_fields_name on public.prior_fields (profile_id, lower(field), lower(area));

alter table public.prior_fields enable row level security;
create policy "prior_fields: own all" on public.prior_fields
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
