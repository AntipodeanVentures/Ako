-- Ako - crash and problem reports from the app.
--
-- Written by the `report` function with the service role; a learner may read
-- their own. `detail` carries the context the app attaches: route history,
-- platform, build, whether it was opened from the home screen, the last
-- console errors, and for a crash the stack.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('crash', 'problem')),
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_reports_created on public.reports (created_at desc);
create index if not exists idx_reports_profile on public.reports (profile_id);

alter table public.reports enable row level security;
create policy "reports: own read" on public.reports for select using (auth.uid() = profile_id);
