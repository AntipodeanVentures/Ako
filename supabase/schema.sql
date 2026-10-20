-- Ako schema: all six migrations in order, for one paste into the Supabase SQL editor.
-- Generated from supabase/migrations/*.sql; run `npm run schema:bundle` to regenerate. Safe to re-run: every statement is idempotent.

-- Ako - initial schema: profiles, Row-Level Security, provisioning.
-- Apply via the Supabase SQL Editor, or with `supabase db push`.
--
-- Model: one learner, one profile row, provisioned by trigger when the
-- auth user is created (the same pattern as Thrive's 0001_initial).
-- Everything the learner owns hangs off profiles.id = auth.uid().

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  -- The generated "what you already know" text used in prompts; rebuilt
  -- from know_items whenever they change, and editable by the learner.
  about text not null default '',
  voice_on boolean not null default true,
  reminder_time text,                       -- "07:10", local time; null = off
  study_plan jsonb,                         -- {"time":"07:00","place":"kitchen table"}
  retention numeric not null default 0.9 check (retention between 0.8 and 0.97),
  new_per_session int not null default 1 check (new_per_session between 0 and 5),
  review_cap int not null default 60 check (review_cap between 10 and 300),
  model jsonb,                              -- learner model across subjects: strengths, misconceptions, analogies, note
  created_at timestamptz not null default now()
);

-- ============================================================
-- Profile provisioning - create a profile row for every new auth user.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Deleting the auth user cascades to everything the learner owns; this is
-- how "delete my data" is honoured. The app calls the delete_account RPC.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
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
-- Ako - spaced-review cards and the review log.
-- Apply via the Supabase SQL Editor, or with `supabase db push`.
--
-- Cards carry their FSRS state as plain columns so "what is due" is one
-- indexed query. The engine's card object maps onto a row one to one
-- (src/engine/scheduling.js fromF/toF); the app reads the subject's cards
-- into memory for a session and writes back the ones it changed.

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id text not null,
  front text not null,
  back text not null,
  concept int,
  concept_name text,
  -- FSRS state
  due timestamptz not null,
  stability numeric not null default 0,
  difficulty numeric not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  learning_steps int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state int not null default 0,
  last_review timestamptz,
  -- successive relearning and the prediction check
  learned_day date,
  relearn_days text[] not null default '{}',
  first_review jsonb,                        -- {"at":..., "ok":true}
  reviews int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_cards_profile_due on public.cards (profile_id, due);
create index if not exists idx_cards_subject on public.cards (subject_id);

create table if not exists public.review_log (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  rating int not null check (rating between 1 and 4),
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  reviewed_at timestamptz not null default now()
);
create index if not exists idx_review_log_profile_day on public.review_log (profile_id, reviewed_at);

alter table public.cards enable row level security;
alter table public.review_log enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['cards', 'review_log']
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

-- The reminder job and the Learn screen both ask the same question.
create or replace function public.due_summary(p_at timestamptz default now())
returns table (subject_id uuid, due_count bigint, next_due timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select subject_id,
         count(*) filter (where due <= p_at) as due_count,
         min(due) filter (where due > p_at) as next_due
  from public.cards
  where profile_id = auth.uid()
  group by subject_id;
$$;
-- Ako - roles (a job to be good at) and their areas.
-- Apply via the Supabase SQL Editor, or with `supabase db push`.
--
-- A role is mapped by the `extract` function into areas, each with the
-- rung it needs. Areas are rows so a subject can link to one and readiness
-- is a query.

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  map jsonb not null,                           -- the normalised role map (summary, evidence, firstSteps)
  created_at timestamptz not null default now()
);
create index if not exists idx_roles_profile on public.roles (profile_id);

create table if not exists public.role_areas (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  area_id text not null,                        -- the map's own id (a1, a2...)
  title text not null,
  kind text not null check (kind in ('knowledge', 'skill', 'interpersonal')),
  level_needed text not null check (level_needed in ('s1', 's2', 's3', 's4', 's5')),
  have boolean not null default false,
  have_why text not null default '',
  subject_id uuid references public.subjects (id) on delete set null,
  evidence jsonb not null default '[]'::jsonb,
  unique (role_id, area_id)
);
create index if not exists idx_role_areas_profile on public.role_areas (profile_id);

alter table public.subjects
  drop constraint if exists subjects_role_area_fk;
alter table public.subjects
  add constraint subjects_role_area_fk foreign key (role_area_id)
  references public.role_areas (id) on delete set null;

alter table public.roles enable row level security;
alter table public.role_areas enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['roles', 'role_areas']
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
-- Ako - model usage metering and the lesson cache.
-- Apply via the Supabase SQL Editor, or with `supabase db push`.
--
-- Written only by the edge functions (service role). A learner can read
-- their own usage; nobody can read the cache from the client.

create table if not exists public.usage (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  kind text not null,                           -- plan, lesson, grade, tutor, extract
  calls int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (profile_id, day, kind)
);

create table if not exists public.lesson_cache (
  cache_key text primary key,                   -- sha256 of subject title + topic title + stage + pitch band + prompt version
  subject_title text not null,
  topic_title text not null,
  stage_id text not null,
  pitch_band int not null,
  payload jsonb not null,                       -- the normalised lesson, before the personal layer
  hits int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.usage enable row level security;
alter table public.lesson_cache enable row level security;

drop policy if exists "usage_select" on public.usage;
create policy "usage_select" on public.usage for select
  using (profile_id = auth.uid());
-- No insert/update policies: the service role (edge functions) bypasses RLS;
-- clients cannot write usage or read the cache.

-- Counters for the limits, used by the functions. Returns today's calls per kind
-- and the last seven days' lesson calls, for the caller named by the function.
create or replace function public.usage_window(p_profile_id uuid)
returns table (kind text, today int, week int)
language sql
stable
security definer
set search_path = public
as $$
  select kind,
         coalesce(sum(calls) filter (where day = current_date), 0)::int as today,
         coalesce(sum(calls) filter (where day > current_date - 7), 0)::int as week
  from public.usage
  where profile_id = p_profile_id and day > current_date - 7
  group by kind;
$$;

create or replace function public.record_usage(
  p_profile_id uuid, p_kind text, p_input bigint, p_output bigint
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage (profile_id, day, kind, calls, input_tokens, output_tokens)
  values (p_profile_id, current_date, p_kind, 1, p_input, p_output)
  on conflict (profile_id, day, kind) do update set
    calls = public.usage.calls + 1,
    input_tokens = public.usage.input_tokens + excluded.input_tokens,
    output_tokens = public.usage.output_tokens + excluded.output_tokens;
$$;
