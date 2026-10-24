-- Ako - evidence that learning stuck.
--
-- probe_items: questions written with each lesson's practice set but never
-- shown in it. Two to six weeks after a topic is mastered, a few are asked
-- in a short weekly retention check. The result goes on the item (asked_at,
-- score, response) and is summarised on the topic (topic_state.extra.retained)
-- and the subject (subjects.stats.probe), which calibrates the mastery bar.
-- `taught` records which prompt version and model produced the lesson, so
-- retention can be compared across them.
--
-- cards.fronts: alternative fronts for the same back, shown in turn on later
-- reviews so a review tests the idea rather than recognition of one wording.

create table if not exists public.probe_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id text not null,
  item jsonb not null,
  taught jsonb,
  created_at timestamptz not null default now(),
  asked_at timestamptz,
  score numeric,
  response text
);
create index if not exists idx_probe_items_open on public.probe_items (profile_id, asked_at);
create index if not exists idx_probe_items_topic on public.probe_items (subject_id, topic_id);

alter table public.probe_items enable row level security;
create policy "probe_items: own all" on public.probe_items
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

alter table public.cards add column if not exists fronts jsonb not null default '[]'::jsonb;
