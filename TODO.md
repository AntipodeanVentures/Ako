# Ako: to do

A running list of outstanding tasks. Tick items off as they are done.

## Before anyone else uses it

- [x] Supabase project created (eu-west-1), migrations 0001 to 0007 applied,
      `.env.development` filled with the public URL and key.
- [x] All five functions deployed and answering (20 October 2026).
- [ ] `ANTHROPIC_API_KEY` set as a function secret (Project Settings, Edge
      Functions, Secrets) with a monthly spend limit on the key, then one
      signed-in smoke test of `plan`.
- [x] `delete_account` installed on the live project (SQL editor, 21 Oct
      2026); Delete my data now removes the auth user too.
- [ ] Privacy and terms (`public/privacy.html`, `public/terms.html`): fill
      the highlighted fields (company, number, address, contact email) and
      read once. A solicitor's review before any paid plan.
- [x] Supabase Authentication, URL configuration set (site URL and the two
      redirect URLs).
- [x] Email: Resend SMTP connected; sending domain `ako.antipodean.ventures`
      (placeholder until the real domain), verified 21 Oct 2026. Sender
      Ako <hello@ako.antipodean.ventures>. Swap the domain in Resend and the
      sender in Supabase when the Ako domain exists.
- [ ] Decide on email confirmation. It is on by default, so the first sign-up
      waits for an email from Supabase's rate-limited sender; turn it off for
      the beta or set up custom SMTP first.
- [x] Icon, splash, favicon and adaptive icon: the wordmark, generated from
      the Instrument Sans semibold (21 Oct 2026). Revisit with a designer later.
- [ ] Custom SMTP for auth emails (Resend, SendGrid or SES); the built-in
      Supabase sender is rate-limited and not for production.
- [ ] Apple Developer Program and Google Play Console enrolment; `eas init`
      to mint the project id; a first internal build.

## From the learning-science audit (21 October 2026)

The audit of the method against the evidence (`docs/learning-science-audit.md`)
ranked twelve findings. Done the same day: a real mastery criterion (three
fully right, including a hard and a mixed item; otherwise the topic stays in
"learning" and comes back simpler), practice that heads for the hard and
mixed items, support that fades only on real fluency, per-concept first
ratings for cards, reviews taking turns between topics, the intake questions
(why, contact so far, focus) feeding the plan and every lesson, the lesson
cache keyed per learner so no one reads another learner's warm-up feedback,
calibration shown on the Done screen, and the new-term cap matched to the
plan. Still to do, in the audit's order:

- [ ] Split the lesson into a cached canonical core and a small per-learner
      call (bridge, warm-up response, mixed items), so caching can return.
- [ ] A weekly mixed retention check across recent topics (`checkEligible`
      exists; add `kind: 'retention'` to `nextStep`); show "secure" per topic
      on the Path; gate the level check on two thirds secure rather than a
      fixed three-day wait.
- [ ] Move teach-back to the day the topic's first card comes due, offered
      from the review screen, instead of straight after recall.
- [ ] A typed answer before the comparison and completion-gap reveals.
- [ ] Judgement of learning on the Done screen ("how many of these cards
      will you remember in a week?"), resolved at first review.
- [ ] Split a topic over two days for the 5 and 15 minute slots.
- [x] Call the learner-model update at the end of each topic (22 Oct 2026),
      so the misconceptions and analogies lines in every prompt fill up.
- [x] A failed level check reopens the topics it exposed and asks for a
      path revision (22 Oct 2026).
- [ ] Dual coding: ask the lesson for a described diagram or table where the
      content is structural; a video search phrase in motor drills.

## The path adapts (22 October 2026)

Done: the intake asks the two or three questions an expert would ask for
the subject (chosen by the model, with tap answers); the learner model is
rewritten after every topic; the topics ahead are revised (insert, refocus,
drop, reorder; started topics never touched; ids stable) when a topic misses
twice, when a level check is failed, at each milestone, and on request from
the Path tab, with each change explained to the learner. Still to do:

- [ ] Let the tutor chat feed the learner model: a question the learner
      asks in a lesson is evidence of a gap.
- [ ] A weekly "how is it going?" prompt on the Learn tab that offers the
      rethink when the learner has missed several sessions or topics.
- [ ] Revisions to lesson pitch: the "too hard / too easy" rating moving
      `subj.pitch`, which the prompts already read.

## Next build sessions

- [x] Teach-back, role-play and drill steps in the session.
- [x] Level checks; the next level's topics written on a pass.
- [x] Profile import on the You tab.
- [ ] Placement check (skip what you already know) and the "known" state.
- [ ] Logging a practice session for physical topics (the drill's checks),
      which moves a topic from practising to mastered.
- [ ] Roles and readiness on the You tab.
- [ ] Reminders (local alerts) on the phone builds.
- [ ] Photo form check and the profile photo import (expo-image-picker).
- [x] Web deploy: https://ako-eight.vercel.app, auto-deploys from main.
- [ ] A proper domain on Vercel when the name is settled; then update
      EXPO_PUBLIC_SITE_URL and the Supabase URL configuration.

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
