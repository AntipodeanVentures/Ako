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
