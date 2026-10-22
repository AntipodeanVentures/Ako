# Ako: learning-science audit of the teaching method

Scope: the prompts, engine constants, session flow and screens in `/home/claude/ako` as of 21 October 2026. Read-only. Line numbers refer to `supabase/functions/_shared/engine/*` for the engine (the `src/engine` copies are identical) and to the app files named.

## 1. Verdict

The design on paper is unusually close to the evidence: retrieval before rereading, a pretest, comparison cases, faded worked examples, confidence ratings with hypercorrection, free recall plus a why question, teach-back, FSRS review mixed across subjects, successive relearning, a delayed level check. The problem is that about a third of that machinery is not wired to anything. The learner model is never updated, the pitch never moves, the "secure" relearning count gates nothing, role-play has an unused pass mark, the judgement-of-learning fields are never written, the interim retention check is never offered, and the cached lesson quietly undoes the pretest by serving another learner's "your warm-up answers got this right". Most damaging, a topic is marked mastered however the practice went, so the ladder's "evidenced" claim rests on reading, not recall. The fixes are mostly small: a handful of parameter and flow changes would make the method do what the prompts already say it does.

## 2. Already sound

Reviews come first, then a due level check, then one new topic (`src/features/subjects/summary.ts:37-51`), and reviews pool every subject (`app/(app)/review.tsx:40-45`). Cards are FSRS-scheduled at a 0.9 target with fuzz and a ten-year cap (`scheduling.js:11-19`); the four review grades are FSRS ratings and "ok" is Good or better (`review.tsx:73-79`).

The lesson asks for a warm-up attempt before teaching (`prompts.js:225-239`), two contrasting cases with a question before the sections (`:280`), a worked example with gaps set by the support level (`:282`, `ladder.js:28-32`), a recall question in the learner's own words and a separate why question (`:284-285`), practice tagged 1 to 5 with a transfer item and two interleaved items against earlier topics (`:286`), and four to six cards that favour why, how and when (`:287`). Grading sees the learner's confidence and is told to make confident errors memorable (`:323`); a confident miss is requeued in the same session (`session.js:75`). The level check is from memory, three days after the last topic, rewords the cards, probes weak concepts and includes a combination question (`prompts.js:333-351`, `ladder.js:40-41`). The motor drill asks for external-focus cues, reducing feedback and a 60-second imagery script (`prompts.js:289`), the Wulf 2013 and Schmidt and Bjork 1992 position. The plan designs backwards from level outcomes, caps new terms per topic and marks threshold concepts for extra relearning (`prompts.js:77-79`). There are no streaks; progress is framed as levels reached and evidenced (`summary.ts:89-115`).

## 3. Findings, ranked by expected impact on learning

### 1. "Mastered" does not require mastery

What it does: `finishTopic` sets `status = 'mastered'` whatever happened in practice (`session.js:102`). Practice stops after two extra rounds even if the criterion was never met (`useSession.ts:339-341`), the teach-back can be skipped (`session/[subjectId].tsx:646-651`), and a role-play finishes at any score; `ROLE_LEVEL_GOOD = 0.7` (`ladder.js:37`) is defined and never read. Partial credit also counts towards the criterion: `P.correct += sc` (`session.js:73`), so six "partly right" answers equal three correct, while each also counts as a miss. A learner can be marked mastered on zero fully correct answers.

Evidence: mastery learning works because progression waits on a demonstrated criterion (Bloom 1984; Kulik, Kulik and Bangert-Drowns 1990). Declaring mastery after exposure is the illusion of competence Bjork and Bjork 2011 describe, and milestones, level-check eligibility and pace estimates all inherit it.

Change (Quick): count only `sc >= 1` towards `CRITERION`; if the criterion is not met when practice ends, set status `learning` (the state exists in `topicStatus`, `progress.js:17`) and offer the topic again next session with `simpler` set; for role-play topics require one run at or above `ROLE_LEVEL_GOOD`, otherwise offer a second run with the debrief on screen.

### 2. The cached lesson contradicts the pretest and the personal layer

What it does: the lesson prompt is told to open by saying what the learner's warm-up answers got right and to write two "mix" questions against this learner's earlier topics (`prompts.js:265-269, 286`). The whole result is cached by subject, topic, stage and pitch band and served to everyone (`lesson/index.ts:48-55`, `cache.ts:1-2`). The comment says a personal layer is added on top; no code does that. On a cache hit the learner reads feedback on someone else's answers and is quizzed against topics they may not have met.

Evidence: the pretesting benefit depends on the correct answer following the attempt (Richland, Kornell and Kao 2009; Pan and Sana 2021). Feedback on the wrong attempt is worse than none, and interleaving against unknown topics is just noise.

Change (Medium): split the prompt. Cache the canonical lesson (sections, worked example, mistakes, recall, why, practice without `mix`, cards). Make a second small call per learner for `bridge`, the warm-up response and the two `mix` items, or move the warm-up response into the warm-up grading feedback, which is already per learner (`prompts.js:321-323`). Quick stopgap: delete the warm-up and `earlier` references from the cached prompt so the lesson is at least not wrong.

### 3. The intake never captures why, what for, or prior knowledge

What it does: `place.tsx:53-63` sends `background: ''` and `why: ''`. The plan prompt then reads "What they want to be able to do: not given" and is asked to "design backwards from what the learner must be able to do" (`prompts.js:67, 76`). Every lesson, warm-up and tutor turn carries "Their goal: not given" (`prompts.js:31`). The `start` extraction that would infer background from the profile (`prompts.js:129-135`) is never called.

Evidence: utility value, the sense that material serves a goal, is one of the better-replicated motivational levers (Hulleman and Harackiewicz 2009); prior knowledge is the strongest single predictor of what a learner can take from a lesson (Ausubel; Kalyuga 2007 for why it changes the right level of support). Without them the "build on what they know" instruction has nothing to build on.

Change (Quick): add two optional free-text fields on `place.tsx`, "What do you want to be able to do with it?" and "What do you already know about it?", and store them in `intake.why` and `intake.background`; call `extract kind: 'start'` to prefill the second from the profile.

### 4. Practice stops before the hard and interleaved items

What it does: the next item is the open one closest to the working level, which starts at 1.5 to 3 (`session.js:20, 58-65`), and practice ends at three correct (`session.js:81`). A learner at pitch 2 who answers three easy items right never sees the difficulty 4 and 5 transfer items or the two `mix` items. "More practice" forbids anything outside the lesson (`prompts.js:312`), so no interleaving arrives later either. Support then fades on this thin evidence: zero misses in three easy items advances `subj.support` (`session.js:108`).

Evidence: retrieval benefits scale with difficulty and with interleaving of confusable material (Rohrer and Taylor 2007; Bjork and Bjork 2011); support should fade on demonstrated fluency, not a short error-free run (Kalyuga 2007; Renkl and Atkinson 2003). The 80 per cent band is a heuristic (Wilson et al. 2019 models binary classification, not declarative learning) and should not stop practice before application.

Change (Quick): require at least one correct answer at difficulty 4 or above and one correct `mix` item before `practiceDone`; let `pickNextItem` prefer `mix` items once two plain items are right; fade support only after two consecutive topics with no misses and a difficulty 4 success. Let `morePracticePrompt` include one mixed item against `earlier` topics.

### 5. Nothing retrieves across topics between the lesson and the level check

What it does: a stage is 12 to 30 topics learned over weeks. In that time cross-topic retrieval is limited to flashcards and the two `mix` items (see 4). `checkEligible` (`progress.js:96-101`) would offer an eight-question mixed retention check every six days on topics at least three days old, and `checkPrompt` already handles `stageId = null`, but nothing calls it. The "secure" count from successive relearning (`progress.js:36-37`, `RELEARN_TARGET = 3`, `ladder.js:35`) is computed, never displayed and never gates stage completion (`progress.js:47` uses `learned`, not `secure`).

Evidence: cumulative, mixed quizzing is where spacing and interleaving pay off together (Cepeda et al. 2008; Rohrer, Dedrick and Stershic 2015). Rawson and Dunlosky 2011 found three relearning sessions on separate days roughly doubled retention over a term; the app has the right number and does nothing with it.

Change (Medium): add `kind: 'retention'` to `nextStep` after reviews when `checkEligible` returns topics, roughly weekly, ten minutes; show "secure" per topic on the Path; make the level check eligible when every topic is learned and at least, say, two thirds are secure, which also removes the need for the arbitrary three-day wait.

### 6. Teach-back is massed onto the recall step

What it does: the learner explains the idea in their own words (`recall`), then explains it again to a simulated novice three turns later in the same sitting (`useSession.ts:284-294`, `prompts.js:391-401`). It is skippable and `st.taught` changes nothing.

Evidence: explaining to others helps most when it is spaced from study and when the explainer must reconstruct (Fiorella and Mayer 2013; Roscoe and Chi 2007 distinguish knowledge-building from knowledge-telling). Immediately after a recall of the same idea it is largely a second telling.

Change (Medium): move the teach-back to the day the topic's first card comes due, offered from the review screen for one topic a day; keep the "student" persona. It becomes a spaced, generative retrieval instead of a fourth production in one session, and shortens the session (see 10).

### 7. The generative steps that are reveal-only

What it does: the two-case comparison ends with "Think, then show the principle" (`session/[subjectId].tsx:256-258`) and the completion gaps with "Show the missing steps" (`:303-307`). Neither asks for anything. The engine has `L.cmp = { text, result }` ready for a typed answer (`session.js:30`) and the screen ignores it.

Evidence: comparison helps when learners articulate the common principle (Gentner, Loewenstein and Thompson 2003; Alfieri, Nokes-Malach and Schunn 2013); completion problems work because the learner produces the missing step (van Merriënboer 1990; Paas 1992). A reveal button is reading with extra taps.

Change (Quick): a one-line text box before each reveal, ungraded or graded with the existing `gradeShort`; disable the reveal until something is typed, with a "skip" link.

### 8. Confidence is collected and never shown back; the JOL is half-built

What it does: every recall and practice answer requires a confidence rating (`session/[subjectId].tsx:363-368, 447-453`). It feeds the grade prompt and the requeue, but the learner never sees their calibration. `subj.errors.confident` is counted and unused (`session.js:66`). `recordRelearn` resolves `st.jolActual` against `st.jol` (`session.js:122-126`) and the database has the columns, but nothing ever asks for a judgement of learning.

Evidence: overconfidence is the main reason learners stop practising too early (Dunlosky and Rawson 2012); seeing one's own calibration improves later allocation of study (Koriat and Bjork 2005). A delayed JOL on the Done screen, resolved at first review, is the cheapest calibration exercise there is (Nelson and Dunlosky 1991).

Change (Quick): on Done, show "Sure on N, right on M of those", and ask "How many of these cards will you remember in a week?" into `st.jol`; show the resolved pair when the topic's first reviews complete.

### 9. Card creation ignores what the learner just got wrong, and review order clusters topics

What it does: all of a topic's cards get the same initial rating, Good if there were no misses else Hard (`session.js:92-96`), although `subj.concepts` already records which concept was missed (`progress.js:254-260`). Reviews are sorted by due time (`review.tsx:44`), and a topic's cards share a due time, so they run as a block despite the comment saying the opposite.

Evidence: a card for a concept missed under retrieval should be scheduled sooner (FSRS treats the first rating as the strongest early signal); blocked review of one topic's cards lets the answer to one card cue the next (Rohrer and Taylor 2007).

Change (Quick): rate a card Again or Hard when its concept's `ok / n` is under 0.7 in this session; after sorting by due day, shuffle within the day or round-robin by topic.

### 10. The session does not fit the slot the learner chose, and new-term limits contradict

What it does: the intake offers 5, 15, 30 or 45 minutes (`place.tsx:28`) but every topic runs the full deck: hook, two warm-up answers, bridge, comparison, 200 to 650 words of sections, worked example, mistakes, recall, why, three to fourteen practice items, three teach-back turns. That is twelve to fifteen productions and well over 15 minutes. Separately, the plan caps a topic at 3 to 5 new terms (`prompts.js:78, 105`) while the lesson allows up to 12 at higher pitches (`ladder.js:20-24`).

Evidence: load per session should be bounded, and two short sessions on the same material beat one long one (Sweller, van Merriënboer and Paas 2019; Cepeda et al. 2006). Sessions that overrun the promised slot are the usual reason habits fail (Lally et al. 2010).

Change (Medium): for 5 and 15 minute slots, split a topic over two days: day one warm-up, learn, recall; day two practice, teach-back. Quick: cap `PITCH.terms` at 5 or 6 to match the plan.

### 11. A failed level check leads nowhere specific

What it does: a fail records `stageChecks[stage].at` and tells the learner to "keep reviewing" (`check/[subjectId].tsx:131, 185`). Each question carries a `topicId`, but failed questions do not reopen topics, add cards or trigger `simpler`.

Evidence: feedback is formative only when it changes the next action (Hattie and Timperley 2007); corrective instruction after a failed mastery test is the active ingredient in mastery learning (Guskey 2010).

Change (Medium): on a fail, set the topics of wrong answers to `learning` or make their cards due now, and open the next check when those are relearned rather than after a fixed three days.

### 12. No dual coding anywhere, and motor and language topics are text-only

What it does: lessons, drills and cards are plain text. A motor topic has no video; a language plan gets written translations but no audio; role-play is typed.

Evidence: words plus a relevant picture outperform words alone (Mayer's multimedia principle); observation of a model is central to motor learning (Wulf 2013); listening and speaking are the skills a conversational-language learner actually wants.

Change (Large): at minimum ask the lesson for one described diagram or table where the content is structural, and surface a video search phrase in the drill; voice role-play is already on the list.

## 4. Do not change

Immediate feedback on practice and recall is fine. Delayed feedback wins in some laboratory studies (Butler, Karpicke and Roediger 2007) but only when learners actually read it later; in an app immediate feedback with an explanation is the safer bet.

Self-graded flip cards are acceptable. Covert retrieval is nearly as effective as typed retrieval (Smith, Roediger and Karpicke 2013); the risk is lenient grading, which finding 8 addresses by showing calibration rather than by forcing typing.

The 0.9 retention target, the three-day level-check delay and the 80 per cent pass mark are all within the evidence and need no tuning; finding 5 changes what qualifies for the check, not the numbers.

Grading warm-up answers before the lesson is fine: the model answer is the "answer follows the attempt" that the pretesting effect requires.

The 80 per cent band and the ±0.5 ability steps are a reasonable heuristic for picking the next item; just do not describe them as evidence-based, and do not let them stop practice before transfer (finding 4).

Sending `METHOD` as the system prompt to the small grading model and to the role-play character is wasteful and slightly off-tone, but harmless to learning.

## 5. Summary

| Rank | Finding | Size | Where |
| --- | --- | --- | --- |
| 1 | Topics are marked mastered regardless of practice, partial credit counts, role-play pass mark unused | Quick | `session.js:73, 102`; `ladder.js:37`; `useSession.ts:339` |
| 2 | Cached lesson serves another learner's warm-up feedback and mix questions | Medium | `lesson/index.ts:48-55`; `prompts.js:265-269, 286` |
| 3 | Intake never captures why, what for or prior knowledge | Quick | `place.tsx:53-63`; `prompts.js:31, 67, 76` |
| 4 | Practice ends before transfer and interleaved items; support fades on thin evidence | Quick | `session.js:58-65, 81, 108`; `prompts.js:312` |
| 5 | No cumulative retrieval between lessons; successive relearning gates nothing | Medium | `progress.js:36-47, 96-101`; `summary.ts:37-51` |
| 6 | Teach-back massed onto recall in the same session | Medium | `useSession.ts:284-294`; `prompts.js:391-401` |
| 7 | Comparison and completion gaps are reveal-only | Quick | `session/[subjectId].tsx:256, 304`; `session.js:30` |
| 8 | Calibration never shown; JOL fields never written | Quick | `session.js:66, 122-126`; `session/[subjectId].tsx:471-499` |
| 9 | Uniform initial card rating; reviews cluster by topic | Quick | `session.js:92-96`; `review.tsx:44` |
| 10 | Session overruns the chosen slot; term limits contradict (5 vs 12) | Medium | `place.tsx:28`; `ladder.js:20-24`; `prompts.js:78` |
| 11 | Failed level check gives no targeted remediation | Medium | `check/[subjectId].tsx:131, 185` |
| 12 | No dual coding; motor and language are text-only | Large | `prompts.js:281-289` |

Also dead: the pitch ratings and `stepBack` (`ladder.js:18`, `session.js:78`, never read), the `simpler` lesson path (`useSession.ts:129`, never passed), the learner-model update (`extract/index.ts:43-50`, never called, so every prompt's misconceptions and analogies lines are empty), `activityDays`, `sameAnswer` and `BAND_TARGET`. Calling the learner-model update at `finishTopic` from `P.log` is a Medium change that makes findings 2 and 3 worth more.
