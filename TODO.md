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

## Model routing (22 October 2026)

One table in `supabase/functions/_shared/limits.ts` decides which model does
which job: the frontier model where the output shapes weeks of study or
decides what counts as mastery (plan, critic, extension, revision, level
check, placement, threshold-concept lessons and lessons taught again), the
mid model for what the learner waits on and for marking (lessons, warm-ups,
tutor turns, grading, the learner model, intake questions), the small model
only for bounded extraction. Any task moves with a secret `MODEL_<TASK>`.
The `plan` function still honours only `MODEL_FRONTIER` until its next
deploy.

- [ ] Record the model name with each usage row (a column on `usage`), so
      spend can be read per task and per model.
- [ ] Put a monthly spend cap on the `ako-server` key in the Anthropic console.

## The path adapts (22 October 2026)

Done: the intake asks the two or three questions an expert would ask for
the subject (chosen by the model, with tap answers); the learner model is
rewritten after every topic; reviews feed the same per-idea record as
practice; the topics ahead are revised (insert, refocus, drop, reorder;
started topics never touched; ids stable) when a topic misses the mark,
every third topic mastered, at each milestone, when a level check is
failed, when two or more cards are forgotten in a review session, and on
request from the Path tab, with each change explained to the learner. A
card forgotten three times reopens its topic, which is taught again from a
different angle (not the cached lesson). Lessons address a listed
misconception early when it touches the topic; the warm-up probes it. The
placement check (skip what you already know) is live for learners who did
not start as complete beginners. The comparison and the completion gaps
ask for a typed answer before the reveal. Still to do:

- [ ] Let the tutor chat feed the learner model: a question the learner
      asks in a lesson is evidence of a gap.
- [ ] A weekly "how is it going?" prompt on the Learn tab that offers the
      rethink when the learner has missed several sessions or topics.
- [ ] Revisions to lesson pitch: the "too hard / too easy" rating moving
      `subj.pitch`, which the prompts already read.

## Home screen and reporting (22 October 2026)

- [x] Web shell (`public/index.html`, read by the single-page export) with
      the manifest, icons, iOS app-capable tags and a caching-free service
      worker, so the site installs to the home screen on iPhone and Android.
- [x] Crash reports (uncaught errors, unhandled rejections, render errors
      via the error boundary) and "Report a problem" on the You tab, both
      stored in `reports` in the project and emailed when the function
      secrets `RESEND_API_KEY` and `REPORT_TO` are set.
- [ ] Set `RESEND_API_KEY` and `REPORT_TO` as function secrets so reports
      arrive by email (until then, read them in the `reports` table).
- [ ] Offline: the service worker caches nothing today. Once the app is in
      daily use, cache the shell and the review queue so reviews work on a
      train.
- [ ] Web push for review reminders on Android and on iPhones with the app
      on the home screen; native push with the store builds.

## Evidence that learning stuck (24 October 2026)

The app now measures whether a topic stayed learned, independently of its
own teaching, and lets that evidence tune the method.

- [x] Held-back questions: four per topic, written with the practice set and
      never shown (`probe_items`), tagged with the prompt version and model
      that taught the topic.
- [x] Weekly retention check (`/probe`): five held-back questions on topics
      mastered two to six weeks ago, across subjects, offered from the Learn
      tab once a week. Results land on the topic ("retained" or "faded" on
      the Path), in the per-idea record, and on the subject.
- [x] Calibration: below 60% retained in a subject, a topic needs four fully
      right answers to count as learned and cards are scheduled for a 93%
      target; between 60% and 75% only the schedule tightens; above that the
      defaults return. A topic with nothing retained is reopened.
- [x] Reviews test the idea, not the wording: each card carries two variant
      fronts (a rephrasing and a small situation) shown in turn.
- [x] Mixed practice (`/mixed/[subjectId]`): once ten topics are learned, a
      weekly set of eight questions across five earlier topics, each needing
      two told apart or combined. A topic with nothing right is reopened.
- [ ] After a month of use: compare retention by prompt version and model
      (`probe_items.taught` against `score`) and write up what it shows.
- [ ] Let the probe draw from subjects that have been paused or finished.
- [ ] Show "retained" on the Learn tab's subject rows once there is data.

## Lesson speed (24 October 2026)

- [x] The lesson text is written the moment a topic opens, while the learner
      does the warm-up; the recall and practice set is written from the
      finished text while they read it (and tests their warm-up mistakes);
      a two-sentence opening answers the warm-up. The wait after
      "Check my answers" drops from the whole generation to a few seconds.
- [x] A broken stream no longer leaves "Writing your lesson" spinning: Try
      again appears, and a retry is served from the cache.
- [x] Repeated taps on Check no longer start repeated generations.
- [ ] Show the first section as soon as it streams in, before the rest.
- [ ] Watch the `usage` table for a week: output tokens per lesson should
      fall with the split; if the set is often slower than the reading,
      move it to the small model for Beginner topics.

## Runs on its own (23 October 2026)

The live site has never needed a terminal: Vercel serves the app, Supabase
runs the functions and the database. What did depend on the app being open
was the work after a session, and nothing reminded anyone to come back.

- [x] After a topic or a review session, the learner model update and any
      path revision run in the `after` function on the server, so they
      finish even if the tab is closed the moment Done appears.
- [x] A daily reminder email: pg_cron calls the `digest` function every hour
      (minute 5); at the hour a person chose it emails them the number of
      reviews due and the next idea, once a day, and not if they have
      already studied. Switch on the You tab ("Daily reminder email", 07:00
      UK time for now). The scheduler's token lives in `app_config` and in
      the cron job on the live project only; the repo carries placeholders.
- [ ] Emails only flow once `RESEND_API_KEY` is set as a function secret
      (the same key as the SMTP password in Supabase Auth). Until then the
      digest logs what it would have sent.
- [ ] Let the person choose the reminder hour (the column already takes a
      time; the switch sets 07:00).
- [ ] A spend cap on the Anthropic key in the Anthropic console, so a bug
      or a busy week cannot run up a surprise bill while nobody is watching.
- [ ] Redeploy `plan` so it honours the per-task `MODEL_<TASK>` secrets
      like the other functions.

## Next build sessions

- [x] Teach-back, role-play and drill steps in the session.
- [x] Level checks; the next level's topics written on a pass.
- [x] Profile import on the You tab.
- [x] Placement check (skip what you already know) and the "known" state
      (22 Oct 2026).
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
