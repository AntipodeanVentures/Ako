-- Ako - the record of knowledge as a page anyone can open.
--
-- records: a snapshot of what a learner knows (levels shown in a check,
-- what was learned here, what is described but not yet checked) issued by
-- the learner under a code. The code is the verification: it resolves to
-- the record Ako holds, or it does not. The learner can reissue (a fresh
-- snapshot under a new code) or revoke (the page stops resolving). The
-- public read goes through the `record` edge function, which looks up one
-- code at a time with the service role; nothing lists records.

create table if not exists public.records (
  code text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '',
  snapshot jsonb not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_records_profile on public.records (profile_id, issued_at desc);

alter table public.records enable row level security;
create policy "records: own all" on public.records
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
