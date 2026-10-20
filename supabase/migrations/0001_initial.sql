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
