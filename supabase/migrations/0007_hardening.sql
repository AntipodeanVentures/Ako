-- Lock down the SECURITY DEFINER helpers so they can only be called by the roles
-- that need them. Applied to the live project on 20 October 2026 after the Supabase
-- security advisor flagged them as callable by anyone.
--
-- add_activity_minutes checks auth.uid() itself, so signed-in users may call it.
-- usage_window and record_usage are for the edge functions only (service role).
-- handle_new_user is a trigger function and is never called directly.
-- due_summary is SECURITY INVOKER and filters on auth.uid(), so it stays as it is.

revoke all on function public.add_activity_minutes(uuid, date, text, numeric) from public, anon;
grant execute on function public.add_activity_minutes(uuid, date, text, numeric) to authenticated, service_role;

revoke all on function public.usage_window(uuid) from public, anon, authenticated;
grant execute on function public.usage_window(uuid) to service_role;

revoke all on function public.record_usage(uuid, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.record_usage(uuid, text, bigint, bigint) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
