-- Ako - subjects, topic and stage state, study minutes.
-- Apply via the Supabase SQL Editor, or with `supabase db push`.
--
-- The plan stays a JSON document per subject in exactly the shape the engine
-- reads and writes (src/engine/types.ts, validated by normalise.js). Topic
-- and stage state are rows so the app, the daily reminder job and the
-- analytics can query them without opening the document.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  intake jsonb not null default '{}'::jsonb,   -- subject, target, current, hours, background, why, syllabus
  plan jsonb not null,                         -- the normalised plan
  plan_version int not null default 4,
  pitch int check (pitch between 1 and 5),     -- lesson level; null = from the starting level
  support text not null default 'full' check (support in ('full', 'faded', 'light')),
  stats jsonb not null default '{}'::jsonb,    -- minutes, log, rlog, reviewLog, lastStudied
  model jsonb,                                 -- learner model for this subject
  role_area_id uuid,                           -- linked in 0005
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subjects_profile on public.subjects (profile_id);

create table if not exists public.topic_state (
  subject_id uuid not null references public.subjects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic_id text not null,
  status text not null default 'learning' check (status in ('learning', 'practising', 'mastered', 'known')),
  correct numeric not null default 0,
  misses int not null default 0,
  relearn_days text[] not null default '{}',
  jol numeric,                                 -- the learner's prediction, 0 to 1
  jol_actual numeric,                          -- what the first reviews showed
  mastered_at timestamptz,
  extra jsonb not null default '{}'::jsonb,    -- practice summary, role-play result, logs, taught flag
  updated_at timestamptz not null default now(),
  primary key (subject_id, topic_id)
);
create index if not exists idx_topic_state_profile on public.topic_state (profile_id);

create table if not exists public.stage_state (
  subject_id uuid not null references public.subjects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  stage_id text not null check (stage_id in ('s1', 's2', 's3', 's4', 's5')),
  reached_at timestamptz,                      -- set only by a passed level check, or by placement
  score int,
  total int,
  placed boolean not null default false,
  checked_at timestamptz,                      -- last attempt, pass or fail
  primary key (subject_id, stage_id)
);

create table if not exists public.activity (
  subject_id uuid not null references public.subjects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  lesson_minutes numeric not null default 0,
  review_minutes numeric not null default 0,
  primary key (subject_id, day)
);
create index if not exists idx_activity_profile_day on public.activity (profile_id, day);

-- ============================================================
-- Row-Level Security: every row belongs to the caller.
-- ============================================================

alter table public.subjects enable row level security;
alter table public.topic_state enable row level security;
alter table public.stage_state enable row level security;
alter table public.activity enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['subjects', 'topic_state', 'stage_state', 'activity']
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$I', v_table);
    execute format('create policy "%1$s_select" on public.%1$I for select using (profile_id = auth.uid())', v_table);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', v_table);
    execute format('create policy "%1$s_insert" on public.%1$I for insert with check (profile_id = auth.uid())', v_table);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', v_table);
    execute format('create policy "%1$s_update" on public.%1$I for update using (profile_id = auth.uid()) with check (profile_id = auth.uid())', v_table);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', v_table);
    execute format('create policy "%1$s_delete" on public.%1$I for delete using (profile_id = auth.uid())', v_table);
  end loop;
end;
$$;

-- ============================================================
-- RPC: add study minutes to today's row without a read-modify-write race.
-- ============================================================

create or replace function public.add_activity_minutes(
  p_subject_id uuid,
  p_day date,
  p_kind text,
  p_minutes numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.subjects where id = p_subject_id and profile_id = auth.uid()) then
    raise exception 'Not your subject';
  end if;
  if p_minutes <= 0 or p_minutes > 240 then
    return;
  end if;
  insert into public.activity (subject_id, profile_id, day, lesson_minutes, review_minutes)
  values (
    p_subject_id, auth.uid(), p_day,
    case when p_kind = 'review' then 0 else p_minutes end,
    case when p_kind = 'review' then p_minutes else 0 end
  )
  on conflict (subject_id, day) do update set
    lesson_minutes = public.activity.lesson_minutes + excluded.lesson_minutes,
    review_minutes = public.activity.review_minutes + excluded.review_minutes;
end;
$$;
