-- Ako - the daily reminder, scheduled inside the database.
--
-- pg_cron runs a job every hour; pg_net posts to the digest function, which
-- emails each learner at their chosen hour (profiles.reminder_time, London
-- time) if they have not studied yet that day. digest_sent_day stops a
-- second email on the same day. The header secret matches the function's
-- row in app_config (migration 0010); it is a random token, not a credential.
-- The live project carries the real token; this file carries a placeholder.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.profiles add column if not exists digest_sent_day date;

select cron.unschedule('ako-digest') where exists (select 1 from cron.job where jobname = 'ako-digest');
select cron.schedule(
  'ako-digest',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://wuikdopfguzrszhyrmyt.supabase.co/functions/v1/digest',
    headers := '{"Content-Type": "application/json", "x-digest-secret": "<the digest token, also in app_config>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
