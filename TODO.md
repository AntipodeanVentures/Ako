# Ako: to do

A running list of outstanding tasks. Tick items off as they are done.

## Before anyone else uses it

- [x] Supabase project created (eu-west-1), migrations 0001 to 0007 applied,
      `.env.development` filled with the public URL and key.
- [x] All five functions deployed and answering (20 October 2026).
- [ ] `ANTHROPIC_API_KEY` set as a function secret (Project Settings, Edge
      Functions, Secrets) with a monthly spend limit on the key, then one
      signed-in smoke test of `plan`.
- [ ] `delete_account` was left out of the live 0001 migration (it deletes
      from `auth.users`, which the migration tool refused). Apply it by hand
      from `supabase/migrations/0001_initial.sql` before the delete-account
      screen ships.
- [ ] Decide on email confirmation. It is on by default, so the first sign-up
      waits for an email from Supabase's rate-limited sender; turn it off for
      the beta or set up custom SMTP first.
- [x] Icon, splash, favicon and adaptive icon: the wordmark, generated from
      the Instrument Sans semibold (21 Oct 2026). Revisit with a designer later.
- [ ] Custom SMTP for auth emails (Resend, SendGrid or SES); the built-in
      Supabase sender is rate-limited and not for production.
- [ ] Apple Developer Program and Google Play Console enrolment; `eas init`
      to mint the project id; a first internal build.

## Next build sessions

- [ ] Teach-back, role-play and drill steps in the session (the engine has
      them; the screen stops at practice for now).
- [ ] Level checks and placement; the "known" state from placement.
- [ ] Profile import (`extract`), roles and readiness on the You tab.
- [ ] Reminders (local alerts) wired to the due summary.
- [ ] Second plan stage: write the next level's topics when the learner
      reaches it (coverTarget covers start and start + 1 only).

## Product decisions still open

- [ ] Free-tier limits (assumed: 3 lessons a week, 40 graded answers a day,
      reviews unlimited). See `supabase/functions/_shared/limits.ts`.
- [ ] Launch price (assumed: £12 to £15 a month, £100 to £120 a year).
- [ ] Android and web first, iOS at the beta release, or all three from the
      start.

## Later phases

- [ ] RevenueCat subscriptions, with the free-tier limits enforced server-side.
- [ ] Server-side push for people who have not opened the app in days.
- [ ] Real-time voice calls for role-plays.
- [ ] Sentry and PostHog; learning-outcome events.
- [ ] Privacy policy and terms with the AI and voice clauses; a solicitor's
      review; the data protection impact assessment.
- [ ] A Māori adviser conversation about the name, and a line in the
      product about its origin.
