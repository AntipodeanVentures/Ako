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
