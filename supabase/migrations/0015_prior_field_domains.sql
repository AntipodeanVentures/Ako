-- Ako - the map in three levels.
--
-- A field the learner brought with them now carries the domain it belongs to
-- (Martial arts for Judo and Brazilian jiu-jitsu, Physics for Aerodynamics),
-- so fields that share a domain share a hub on the map. '' until the placing
-- pass has run for the learner; the app fills it in.

alter table public.prior_fields add column if not exists domain text not null default '';
