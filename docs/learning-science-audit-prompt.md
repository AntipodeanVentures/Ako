# The audit prompt

The brief given to an independent reviewer (a separate Claude agent with read access to the repository and no part in writing it) on 21 October 2026. Re-run it, unchanged apart from the date, whenever the teaching method changes, and compare the result with `learning-science-audit.md`.

Agent type: general-purpose

```
You are reviewing the teaching method of "Ako", an AI tutor app (Expo + Supabase edge functions calling Claude), against the cognitive science of learning. Read-only: do not edit any file. Produce a written audit.

Repository: /home/claude/ako. The method lives mostly in these files; read them fully:
- supabase/functions/_shared/engine/prompts.js (every prompt: plan, plan review, warm-up, lesson, more practice, grading, level check, debrief, tutor, extraction)
- supabase/functions/_shared/engine/ladder.js (five-stage ladder, PITCH levels, SUPPORT fading, LEVEL_PASS, LEVEL_DELAY)
- supabase/functions/_shared/engine/progress.js and scheduling.js (mastery criteria, topic state, FSRS scheduling, level checks, concept tracking)
- supabase/functions/_shared/engine/normalise.js (what the app keeps from each model answer)
- supabase/functions/plan/index.ts, lesson/index.ts, grade/index.ts, tutor/index.ts, extract/index.ts
- src/features/session/useSession.ts (the session flow: warm → learn → drill → recall → practice → teach → roleplay → done)
- app/(app)/session/[subjectId].tsx (what the learner sees at each step), app/(app)/review.tsx (spaced review), app/(app)/check/[subjectId].tsx (level check), app/(app)/(tabs)/learn.tsx and src/features/subjects/summary.ts (what "today" offers), src/screens/PathView.tsx
- app/(onboarding)/goal.tsx and place.tsx (intake), src/features/subjects/planBuilder.ts
- TODO.md (what is already planned)

Audit the design against the evidence, covering at least: retrieval practice and the testing effect; spacing, successive relearning and FSRS use (review target 0.9, card quality, how many cards per lesson, whether reviews are mixed across subjects); interleaving vs blocking; worked examples, completion problems and the expertise-reversal effect (the SUPPORT fading); desirable difficulties and the 80% productive band; pretesting / generation (the warm-up); elaborative interrogation and self-explanation (the "why" question, the teach-back step); dual coding and cognitive load (lesson length, number of new terms, section structure); feedback timing and quality (immediate vs delayed, confidence ratings, hypercorrection); metacognition and calibration (confidence judgements, judgements of learning); transfer (varied practice, far-transfer questions); motor learning (external focus, variability, reduced feedback, mental imagery); role-play for interpersonal skills; motivation and engagement (goal setting, progress visibility, autonomy, habit formation, session length, streaks vs mastery framing); mastery criteria and level checks (80% pass, 3-day delay); personalisation (learner model, prior knowledge, misconceptions); what the plan prompt asks for and whether the intake captures why/what-for/focus. Also look for things that are theatrically "evidence-based" but do nothing, prompts that contradict each other, steps that add time without learning value, and any place where the app grades or schedules in a way the evidence does not support.

Write the audit to /tmp/claude-0/-home-claude/521e9428-6d35-5d83-af93-6bfe18535651/scratchpad/audit/learning-science-audit.md (create the folder). Structure:
1. One-paragraph verdict.
2. "Already sound": what the method gets right, with the file and line that does it (short).
3. "Findings", ranked by expected impact on learning, each with: what the app does now (file:line), what the evidence says (name the effect and one or two key sources, e.g. Roediger & Karpicke 2006, Dunlosky et al. 2013, Cepeda et al. 2008, Rohrer & Taylor 2007, Kalyuga 2007, Richland et al. 2009, Butler & Roediger 2008, Wulf 2013, Bjork & Bjork 2011, Rawson & Dunlosky 2011), and the concrete change (prompt wording, a parameter, a flow change), tagged Quick (under an hour), Medium, or Large.
4. "Do not change": things that look wrong but are fine, briefly.
5. A table summarising the findings: rank, finding, size, where.

Be specific and sceptical; plain British English; no em-dashes; no bullet-point padding. Around 1500 to 2500 words. When done, reply with only the file path and the five highest-ranked findings in one line each.
```
