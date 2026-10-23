-- Ako - server-only configuration. Row-level security with no policies, so
-- only the service role (the functions) can read it. Holds the token the
-- scheduler sends to the digest function. The live project carries the real
-- token; this file carries a placeholder.

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value) values ('digest_secret', '<the digest token, also in the cron job>')
on conflict (key) do update set value = excluded.value, updated_at = now();
