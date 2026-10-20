-- Ako - what the learner already knows, as confirmed items.
-- Apply via the Supabase SQL Editor, or with `supabase db push`.
--
-- Items come from typed answers, a pasted CV or LinkedIn text, or a photo
-- of a certificate. Nothing is inserted until the learner confirms it on
-- screen; the extraction itself happens in the `extract` edge function and
-- never stores anything.

create table if not exists public.know_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('job', 'qualification', 'language', 'sport', 'hobby', 'field', 'tool')),
  title text not null,
  detail text not null default '',          -- level, years, grade: "8 years", "brown belt", "grade 5"
  source text not null default 'typed' check (source in ('typed', 'cv', 'photo', 'linkedin')),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_know_items_profile on public.know_items (profile_id);

alter table public.know_items enable row level security;

drop policy if exists "know_items_select" on public.know_items;
create policy "know_items_select" on public.know_items for select
  using (profile_id = auth.uid());
drop policy if exists "know_items_insert" on public.know_items;
create policy "know_items_insert" on public.know_items for insert
  with check (profile_id = auth.uid());
drop policy if exists "know_items_update" on public.know_items;
create policy "know_items_update" on public.know_items for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "know_items_delete" on public.know_items;
create policy "know_items_delete" on public.know_items for delete
  using (profile_id = auth.uid());
