-- Ako - a card the learner flagged as wrong leaves the review queue until it is checked.
alter table public.cards add column if not exists suspended boolean not null default false;
