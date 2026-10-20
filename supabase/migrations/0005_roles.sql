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
