# Ako: the evidence base

The literature Ako's method rests on, banked in one place, with what the app does about each finding and where in the code it lives. Three things keep it honest:

1. `src/engine/evidence.js` is the machine-readable form of this file: each principle with the engine constants and prompt phrases that implement it.
2. `src/engine/__tests__/evidence.test.js` fails if a constant or prompt drifts from the ledger, naming the paper it drifted from.
3. The plan critic (`reviewPlanPrompt`) carries the curriculum checklist derived from here, so every new path is checked against it before it is used.

Status key: **aligned** (does what the evidence says), **partial** (does it, but not fully or not everywhere), **gap** (does not yet), **provisional** (a value chosen by reasoning, to be set from Ako's own data).

Last reviewed 24 October 2026. The earlier audit (`learning-science-audit.md`, 21 October) found that much of the method existed on paper but was not wired up; the fixes from it are in, and this file is the standing reference.

---

## A. Memory: making it stick

### 1. Retrieval practice beats restudy, for retention and for transfer
**Finding.** Recalling from memory strengthens learning far more than rereading or re-explaining, and the advantage grows with the delay before the test. The effect transfers to new questions and situations, not only the tested items.
**Sources.** Roediger and Karpicke (2006), *Psychological Science* 17: the classic demonstration. Karpicke and Blunt (2011), *Science* 331: retrieval beat concept mapping. Rowland (2014), *Psychological Bulletin* 140: meta-analysis, g about 0.5. Adesope, Trevisan and Sundararajan (2017), *Review of Educational Research* 87: meta-analysis across formats. Pan and Rickard (2018), *Psychological Bulletin* 144: transfer meta-analysis. Dunlosky, Rawson, Marsh, Nathan and Willingham (2013), *Psychological Science in the Public Interest* 14: practice testing and distributed practice rated the two high-utility techniques; rereading, highlighting and summarising low.
**Ako.** Every lesson ends in free recall in the learner's own words, a why question and six practice questions; reviews are FSRS-scheduled recall; the level check, the retention probe and mixed practice are all retrieval from memory. `prompts.js` (`practicePrompt`), `session.js`, `review.tsx`.
**Status.** Aligned.

### 2. Spacing, and the gap that fits the retention interval
**Finding.** Practice spread over time beats the same practice massed. The best gap between sessions scales with how long the memory must last: roughly a day for a week, a week for a month, three weeks or more for a year, with a broad plateau around the optimum.
**Sources.** Ebbinghaus (1885). Cepeda, Pashler, Vul, Wixted and Rohrer (2006), *Psychological Bulletin* 132: synthesis of 254 studies. Cepeda, Vul, Rohrer, Wixted and Pashler (2008), *Psychological Science* 19: the "temporal ridgeline" of optimal gaps. Karpicke and Bauernschmidt (2011), *JEP: Learning, Memory, and Cognition* 37: absolute spacing matters more than expanding versus equal schedules.
**Ako.** Cards are scheduled by FSRS, a memory model fitted on hundreds of millions of real reviews (Ye, Su and Cao, 2022, *KDD*; in the same line as Tabibian et al., 2019, *PNAS*), each card due when its predicted recall falls to the target (0.9). The retention probe follows Cepeda's ridgeline: about three weeks after mastery, then five weeks on. `scheduling.js`, `progress.js` (`PROBE_FIRST_TARGET`, `PROBE_SECOND_GAP`).
**Status.** Aligned.

### 3. Successive relearning: three recalls, then three spaced relearning sessions
**Finding.** Learning to a criterion of about three correct recalls in the first sitting, then relearning to criterion in about three later spaced sessions, is the efficient recipe for durable knowledge. More recalls in the first sitting add little; more spaced relearning adds a lot.
**Sources.** Rawson and Dunlosky (2011), *JEP: General* 140. Rawson, Dunlosky and Sciartelli (2013), *Educational Psychology Review* 25: exam gains in real courses. Vaughn and Rawson (2011), *JEP: LMC* 37: what further criterion levels buy.
**Ako.** `CRITERION = 3` fully right practice answers (including a hard item and a mixed item) before a topic counts as learned; `RELEARN_TARGET = 3` recalled reviews on separate days before it counts as secure; a threshold concept needs one more. Poor delayed retention tightens the spacing (reviews aim for 0.93 or 0.95 recall) and adds a relearning session rather than raising the first-sitting bar. `ladder.js`, `session.js` (`metCriterion`), `progress.js` (`calibrateFromProbes`).
**Status.** Aligned.

### 4. Desirable difficulties and the productive band
**Finding.** Conditions that make learning feel harder and slower (spacing, interleaving, testing, generation) produce better long-term retention and transfer; conditions that make it feel fluent often do not. Practice is most productive when success is high but not certain, around 80 to 85 percent.
**Sources.** Bjork (1994), in *Metacognition: Knowing about Knowing*; Bjork and Bjork (2011), "Making things hard on yourself, but in a good way". Rosenshine (2012), *American Educator* 36: about 80 percent success during guided practice. Wilson, Shenhav, Straccia and Cohen (2019), *Nature Communications* 10: the 85 percent rule.
**Ako.** Practice items are tagged 1 to 5 and the next item is picked near the learner's working level, which rises on success and falls on a miss (`BAND_TARGET = 0.8`); once two are right the deck heads for a mixed item and a hard item so the sitting does not end on easy recognition. `session.js` (`pickNextItem`).
**Status.** Aligned.

### 5. Variable retrieval and transfer
**Finding.** Repeated testing with varied questions produces better transfer than repeated testing with the same question; recall cued by one fixed wording risks recognising the cue rather than knowing the idea.
**Sources.** Butler (2010), *JEP: LMC* 36. Barnett and Ceci (2002), *Psychological Bulletin* 128: the taxonomy of far transfer. Pan and Rickard (2018), as above.
**Ako.** Each card carries two variant fronts (a rephrasing and a short situation) shown in turn; held-back probe questions set the idea in a situation unlike the lesson's examples; mixed practice sets topics against each other in new situations. `scheduling.js` (`cardFront`), `prompts.js` (`practicePrompt`, `mixedPrompt`).
**Status.** Aligned.

### 6. Sleep consolidates, and practice split across a night needs less relearning
**Finding.** Memory consolidation depends on sleep; practice split across a night of sleep roughly halves the relearning needed and improves retention at six months compared with the same practice in one day.
**Sources.** Diekelmann and Born (2010), *Nature Reviews Neuroscience* 11. Rasch and Born (2013), *Physiological Reviews* 93. Mazza et al. (2016), *Psychological Science* 27: "Relearn faster and retain longer". Smolen, Zhang and Byrne (2016), *Nature Reviews Neuroscience* 17: the cellular case for spacing.
**Ako.** The first review of a new card falls on a later day, and relearning counts only on separate days. The lesson itself, including its recall step, still happens in one sitting; splitting the recall and practice to the next day was proposed and deferred.
**Status.** Partial (deferred by choice; the evidence for the split is strong).

## B. Instruction: how the lesson teaches

### 7. Attempt first: pretesting and productive failure
**Finding.** Trying to answer before being taught, even when the attempt fails, improves learning of the subsequent material, provided the correct answer follows. Problem solving before instruction beats instruction before problem solving for conceptual understanding and transfer.
**Sources.** Richland, Kornell and Kao (2009), *JEP: Applied* 15. Kornell, Hays and Bjork (2009), *JEP: LMC* 35. Kapur (2008), *Cognition and Instruction* 26; Sinha and Kapur (2021), *Review of Educational Research* 91: meta-analysis of productive failure. Slamecka and Graf (1978), *JEP: Human Learning and Memory* 4: the generation effect.
**Ako.** The warm-up asks two questions before any teaching: one drawing on what the learner knows, one a prediction with three options where the wrong two are common beliefs; the opening of the lesson then answers them. The compare step asks for the principle before the sections. `prompts.js` (`warmupPrompt`, `bridgePrompt`, "compare").
**Status.** Aligned.

### 8. Worked examples, faded as expertise grows; guidance for novices
**Finding.** Novices learn more from studying worked examples than from solving problems unaided; as competence grows, examples should fade into completion problems and then independent problems, or they start to hinder (the expertise reversal effect). Minimal guidance fails novices.
**Sources.** Sweller and Cooper (1985), *Cognition and Instruction* 2. Sweller, van Merriënboer and Paas (1998; 2019), *Educational Psychology Review*. Renkl and Atkinson (2003), *Educational Psychologist* 38: fading. Kalyuga, Ayres, Chandler and Sweller (2003), *Educational Psychologist* 38: expertise reversal. Kirschner, Sweller and Clark (2006), *Educational Psychologist* 41.
**Ako.** Three support levels (full worked example, completion problem with gaps, brief example only) that fade on fluency and return after a rough sitting. `ladder.js` (`SUPPORT`), `session.js` (`finishTopic`).
**Status.** Aligned.

### 9. Working memory limits: few new elements at a time
**Finding.** Working memory holds about four new elements; instruction that introduces more at once overloads it. Split dense material; one idea per section.
**Sources.** Cowan (2001), *Behavioral and Brain Sciences* 24. Sweller (1988), *Cognitive Science* 12. Mayer and Moreno (2003), *Educational Psychologist* 38: ways to reduce load.
**Ako.** At most 3 new terms for a complete beginner, 4 for a beginner, 6 higher up; sections of 2 to 4 sentences with one idea each; topics of one core idea in 20 to 45 minutes, split if denser (the plan critic enforces it). `ladder.js` (`PITCH`), `prompts.js`.
**Status.** Aligned.

### 10. Build on prior knowledge; compare cases to find the principle
**Finding.** What the learner already knows is the strongest determinant of what they can learn next. Comparing two analogous or contrasting cases, with a prompt to find what they share, induces the underlying principle far better than one case or a definition.
**Sources.** Ausubel (1968), *Educational Psychology: A Cognitive View*. Bransford, Brown and Cocking (2000), *How People Learn*; National Academies (2018), *How People Learn II*. Gick and Holyoak (1983), *Cognitive Psychology* 15. Schwartz and Bransford (1998), *Cognition and Instruction* 16: "a time for telling". Alfieri, Nokes-Malach and Schunn (2013), *Educational Psychologist* 48: case-comparison meta-analysis.
**Ako.** Every lesson opens with a bridge to something known (the warm-up answer, an earlier topic, the learner's own fields from the profile), then two contrasting cases with a question before the sections; the plan orders topics from the familiar outward. `prompts.js` (`learnerLines`, "bridge", "compare").
**Status.** Aligned.

### 11. Misconceptions must be confronted, not bypassed
**Finding.** A held misconception is not displaced by new information alone; it must be named, shown to be plausible, shown to fail, and replaced. Refutation texts that do this outperform standard expository text.
**Sources.** Posner, Strike, Hewson and Gertzog (1982), *Science Education* 66. Chi (2008), in *International Handbook of Research on Conceptual Change*. Tippett (2010), *International Journal of Science and Mathematics Education* 8. Schroeder and Kucera (2022), *Educational Psychology Review* 34: meta-analysis of refutation text.
**Ako.** The learner model records misconceptions seen in answers; the lesson is told to address any that touch the topic explicitly and early (name it, show why it tempts, where it breaks, test it); the warm-up's wrong options are the common beliefs; a wrong warm-up answer gets a practice question of its own. `prompts.js` (`lessonPrompt`, `practicePrompt`), `after/index.ts` (learner model).
**Status.** Aligned.

### 12. Threshold concepts
**Finding.** A few ideas in any field are transformative and troublesome: once grasped they change how everything else looks, and they are where learners get stuck. They deserve more time, more examples and more relearning.
**Sources.** Meyer and Land (2003; 2005), *Higher Education* 49.
**Ako.** The plan marks at most one in five topics as threshold; they are written by the strongest model with two comparison cases and a mechanism question, and need one more relearning session. `prompts.js`, `ladder.js` (`relearnTarget`).
**Status.** Aligned.

### 13. Feedback that explains why; confident errors corrected hardest
**Finding.** Feedback works when it says what was right, what was wrong and why the correct answer is correct; explanation feedback transfers where correct-answer feedback does not. Errors made with high confidence are the most likely to be corrected when the feedback is clear (hypercorrection).
**Sources.** Hattie and Timperley (2007), *Review of Educational Research* 77; Wisniewski, Zierer and Hattie (2020), *Frontiers in Psychology* 10. Butler, Godbole and Marsh (2013), *JEP* 105. Butler and Roediger (2008), *Memory & Cognition* 36. Butterfield and Metcalfe (2001), *JEP: LMC* 27; Metcalfe (2017), *Annual Review of Psychology* 68.
**Ako.** The grader explains why the right answer is right; every question carries an explanation; the learner states confidence before each answer and a confident miss gets the most explicit correction and is requeued in the sitting. `prompts.js` (`gradePrompt`), `session.js`.
**Status.** Aligned.

### 14. Self-explanation, elaboration and teaching back
**Finding.** Generating an explanation of why something is so, or teaching it to someone else, produces deeper learning than receiving the explanation; the learner's constructive activity matters more than the tutor's moves.
**Sources.** Chi, de Leeuw, Chiu and LaVancher (1994), *Cognitive Science* 18; Bisra, Liu, Nesbit, Salimi and Winne (2018), *Educational Psychology Review* 30: meta-analysis. Pressley et al. (1987), *JEP: LMC* 13: elaborative interrogation. Fiorella and Mayer (2013), *Contemporary Educational Psychology* 38; Fiorella and Mayer (2016), *Educational Psychology Review* 28: eight generative strategies. Kobayashi (2019), *British Journal of Educational Psychology* 89: learning by teaching meta-analysis. Chi, Siler, Jeong, Yamauchi and Hausmann (2001), *Cognitive Science* 25.
**Ako.** The why question in every lesson; the learner types their own answer before the principle or the missing steps are revealed; the teach-back step with a model playing a student who asks for clarification. `session/[subjectId].tsx` (LearnStep, TeachStep), `tutor/index.ts`.
**Status.** Aligned.

### 15. Interleaving builds discrimination
**Finding.** Mixing problems or examples from different categories, rather than blocking them, improves later performance where the task is to tell similar things apart; the gain is largest for confusable material and shows up on delayed tests. Mixing should run through practice, not happen once.
**Sources.** Rohrer and Taylor (2007), *Instructional Science* 35. Kornell and Bjork (2008), *Psychological Science* 19. Rohrer, Dedrick and Stershic (2015), *JEP* 107; Rohrer, Dedrick, Hartwig and Cheung (2020), *JEP* 112: a year-long randomised trial. Brunmair and Richter (2019), *Psychological Bulletin* 145: meta-analysis; similarity moderates the effect.
**Ako.** Two of every topic's six practice questions set it against earlier topics; reviews interleave topics and subjects within a day; a mixed set across up to five earlier topics runs from four learned topics and after every three more. `prompts.js` ("mix"), `review.tsx` (`interleave`), `progress.js` (`mixedDue`).
**Status.** Aligned.

### 16. Vocabulary: group by theme or situation, not by semantic category
**Finding.** Learning new words in semantically clustered sets (colours together, fruits together) slows learning and causes interference; thematic sets (the words of one situation or story) help. Spacing reduces the interference.
**Sources.** Tinkham (1993; 1997), *System* 21; *Second Language Research* 13. Waring (1997), *System* 25. Finkbeiner and Nicol (2003), *Applied Psycholinguistics* 24. Erten and Tekin (2008), *System* 36. Nakata and Suzuki (2019), *Studies in Second Language Acquisition* 41. Nation (2013), *Learning Vocabulary in Another Language*.
**Ako.** The method text now says: group new words by theme or situation, never by semantic category. Corrected 24 October 2026; earlier wording ("small related sets") was ambiguous and could be read as semantic clustering.
**Status.** Aligned (corrected).

### 17. Mastery learning and the tutoring effect
**Finding.** Requiring demonstrated mastery before moving on, with corrective instruction for those who have not reached it, raises achievement substantially; one-to-one tutoring with mastery raised it by about two standard deviations in Bloom's studies. Step-based intelligent tutoring systems approach the effect of human tutors; unguarded chatbot help that hands over answers can lower learning, while a tutor with guardrails does not.
**Sources.** Bloom (1968), *Evaluation Comment*; Bloom (1984), *Educational Researcher* 13. Kulik, Kulik and Bangert-Drowns (1990), *Review of Educational Research* 60. VanLehn (2011), *Educational Psychologist* 46; Kulik and Fletcher (2016), *Review of Educational Research* 86. Koedinger, Corbett and Perfetti (2012), *Cognitive Science* 36: the KLI framework. Koedinger, Carvalho, Liu and McLaughlin (2023), *PNAS* 120: learners differ in where they start far more than in how fast they learn; mastery typically takes about seven practice opportunities per knowledge component. Bastani et al. (2025), *PNAS* 122: generative AI without guardrails harmed high-school maths learning; a guarded tutor did not. Kestin et al. (2025), *Scientific Reports* 15: a research-based AI tutor beat in-class active learning in a randomised trial.
**Ako.** A topic counts as learned only on the criterion; it comes back simpler if not; the tutor never hands over an answer the learner has not attempted (typed answer before the reveal; teach-back and role-play partners stay in role); practice and reviews count opportunities per idea (`concepts`). `session.js`, `tutor/index.ts`.
**Status.** Aligned; opportunity counting per idea is partial (see gaps).

## C. The learner: judgement, motivation, habit

### 18. Calibration: overconfidence undermines learning
**Finding.** Learners who judge themselves as knowing more than they do stop studying too early; judgements made after a delay are more accurate than those made immediately; fluency of reading is mistaken for knowing.
**Sources.** Dunlosky and Rawson (2012), *Learning and Instruction* 22. Nelson and Dunlosky (1991), *Psychological Science* 2: the delayed-JOL effect. Bjork, Dunlosky and Kornell (2013), *Annual Review of Psychology* 64. Koriat (1997), *JEP: General* 126.
**Ako.** Confidence is stated before every practice answer and shown against outcomes on the Done screen; a judgement of learning is recorded and compared with the first review. The judgement is asked at the end of the sitting, where the evidence says a delayed judgement would be more accurate.
**Status.** Partial (ask the judgement at the first review instead).

### 19. Autonomy, purpose and relevance
**Finding.** Learning that the learner has chosen, that connects to their purposes, and that gives them a sense of growing competence is sustained; writing about why material matters to oneself raises interest and performance. Specific, challenging goals beat vague ones; implementation intentions (when and where) make habits form.
**Sources.** Ryan and Deci (2000), *American Psychologist* 55. Hulleman and Harackiewicz (2009), *Science* 326. Locke and Latham (2002), *American Psychologist* 57. Gollwitzer and Sheeran (2006), *Advances in Experimental Social Psychology* 38. Lally et al. (2010), *European Journal of Social Psychology* 40: habit formation takes weeks to months.
**Ako.** The intake asks why and what for, and the path is written to it; the learner picks the level aimed for and the minutes on most days; the daily reminder at a chosen hour; "Rethink my path" on request. No streaks: progress is levels reached and evidenced.
**Status.** Aligned.

## D. Physical skills

### 20. Motor learning: external focus, variable practice, faded feedback, mental rehearsal
**Finding.** Attention on the effect of a movement beats attention on the body; random and varied practice beats blocked drilling for retention and transfer once the movement exists; feedback given less often as skill forms produces better retention; mental practice adds a modest, reliable amount to physical practice; sleep between sessions consolidates the skill.
**Sources.** Wulf (2013), *International Review of Sport and Exercise Psychology* 6; Wulf and Lewthwaite (2016), *Psychonomic Bulletin & Review* 23. Shea and Morgan (1979), *JEP: Human Learning and Memory* 5: contextual interference. Guadagnoli and Lee (2004), *Journal of Motor Behavior* 36: the challenge point. Winstein and Schmidt (1990), *JEP: LMC* 16; Salmoni, Schmidt and Walter (1984), *Psychological Bulletin* 95. Driskell, Copper and Moran (1994), *Journal of Applied Psychology* 79. Walker et al. (2002), *Neuron* 35.
**Ako.** The drill asks for a brief demonstration, then varied game-like practice that keeps the decision in the drill, external-focus cues, feedback that reduces as form improves, a 60-second imagery script, and a photo form check. `prompts.js` ("drill"), `grade/index.ts` (photo).
**Status.** Aligned.

## E. Curriculum design

### 21. Backward design, constructive alignment and whole tasks
**Finding.** Design from the outcomes back: decide what the learner will be able to do and how it will be checked, then choose the material. Complex skills should be practised as whole tasks of rising complexity with part-task practice only where a component needs it, not as isolated fragments. Core ideas should be revisited at greater depth rather than treated as finished.
**Sources.** Wiggins and McTighe (1998; 2005), *Understanding by Design*. Biggs (1996), *Higher Education* 32: constructive alignment. van Merriënboer and Kirschner (2007; 2018), *Ten Steps to Complex Learning* (4C/ID). Bruner (1960), *The Process of Education*: the spiral curriculum. Dreyfus and Dreyfus (1980): the five-stage skill model behind the ladder; the Common European Framework of Reference and the UK FHEQ as external anchors.
**Ako.** Each level is described by 3 to 6 observable outcomes with a real-world check; topics are derived from the outcomes and every outcome must be served; milestones are capabilities with a concrete test; later stages revisit earlier core ideas; the critic pass checks prerequisites, order, density, coverage, accuracy, level, thresholds, whole-task milestones and vocabulary grouping. `prompts.js` (`planPrompt`, `reviewPlanPrompt`).
**Status.** Aligned.

### 22. Measuring whether it worked
**Finding.** A method is only as good as its delayed, independent test. Mastery in the sitting is not retention a month later; the two must be measured separately, and the measurement must use items the learner has not rehearsed.
**Sources.** Follows from 1 to 3 above; Soderstrom and Bjork (2015), *Perspectives on Psychological Science* 10: learning versus performance.
**Ako.** Four held-back questions per topic, never shown; a retention probe at about three and eight weeks; results per topic, per idea and per subject; each lesson tagged with the prompt version and model that taught it so retention can be compared across them. `probe.tsx`, `probe_items`, `progress.js`.
**Status.** Aligned; the calibration thresholds (60 and 75 percent) are provisional until the probes supply the curve.

---

## F. Claims Ako deliberately does not build on

- **Learning styles.** Matching instruction to a claimed style has no supporting evidence (Pashler, McDaniel, Rohrer and Bjork, 2008, *PSPI* 9). The method text forbids it.
- **Growth mindset interventions.** Effects are small and conditional (Sisk et al., 2018, *Psychological Science* 29; Yeager et al., 2019, *Nature* 573). Ako does not lecture about mindset; it gives evidence of progress instead.
- **Hattie's effect-size rankings** are widely cited and methodologically contested; individual findings above are cited to their primary studies, not to the ranking.
- **Deliberate practice as the whole story.** Ericsson, Krampe and Tesch-Römer (1993) is foundational for the structure of practice; Macnamara, Hambrick and Oswald (2014), *Psychological Science* 25, show it explains less of expert variance than claimed. Ako takes the practice structure, not the "anyone, with enough hours" claim.
- **Brain training and neuromyths** (left/right brain, 10 percent of the brain): no bearing on design.

## G. Gaps, in order of expected value

1. **Split the lesson's recall and practice to the next day** (6). Strong evidence; deferred by product choice.
2. **Dual coding.** Words with a relevant picture beat words alone (Paivio, 1986; Mayer, 2009, *Multimedia Learning*; Butcher, 2006). Lessons are text only.
3. **Judgement of learning at the first review**, not at the end of the sitting (18).
4. **Opportunities per idea.** Track that each concept gets its seven or so retrieval opportunities across the first fortnight (17), and top up where one is short.
5. **Hook as a seductive detail.** The one-sentence hook is kept short so it does not become the kind of interesting-but-irrelevant detail that harms learning (Harp and Mayer, 1998, *JEP* 90). Keep an eye on it.

## H. Reading list (full references)

Adesope, O. O., Trevisan, D. A., and Sundararajan, N. (2017). Rethinking the use of tests: A meta-analysis of practice testing. *Review of Educational Research*, 87(3), 659–701.
Alfieri, L., Nokes-Malach, T. J., and Schunn, C. D. (2013). Learning through case comparisons: A meta-analytic review. *Educational Psychologist*, 48(2), 87–113.
Ausubel, D. P. (1968). *Educational Psychology: A Cognitive View*. Holt, Rinehart and Winston.
Barnett, S. M., and Ceci, S. J. (2002). When and where do we apply what we learn? A taxonomy for far transfer. *Psychological Bulletin*, 128(4), 612–637.
Bastani, H., Bastani, O., Sungu, A., Ge, H., Kabakcı, Ö., and Mariman, R. (2025). Generative AI without guardrails can harm learning: Evidence from high school mathematics. *PNAS*, 122.
Biggs, J. (1996). Enhancing teaching through constructive alignment. *Higher Education*, 32(3), 347–364.
Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., and Winne, P. H. (2018). Inducing self-explanation: A meta-analysis. *Educational Psychology Review*, 30(3), 703–725.
Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe and A. Shimamura (eds), *Metacognition: Knowing about Knowing*. MIT Press.
Bjork, E. L., and Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In *Psychology and the Real World*. Worth.
Bjork, R. A., Dunlosky, J., and Kornell, N. (2013). Self-regulated learning: Beliefs, techniques, and illusions. *Annual Review of Psychology*, 64, 417–444.
Bloom, B. S. (1984). The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring. *Educational Researcher*, 13(6), 4–16.
Bransford, J. D., Brown, A. L., and Cocking, R. R. (eds) (2000). *How People Learn: Brain, Mind, Experience, and School*. National Academy Press. National Academies of Sciences, Engineering, and Medicine (2018). *How People Learn II*.
Bruner, J. S. (1960). *The Process of Education*. Harvard University Press.
Brunmair, M., and Richter, T. (2019). Similarity matters: A meta-analysis of interleaved learning and its moderators. *Psychological Bulletin*, 145(11), 1029–1052.
Butler, A. C. (2010). Repeated testing produces superior transfer of learning relative to repeated studying. *JEP: Learning, Memory, and Cognition*, 36(5), 1118–1133.
Butler, A. C., Godbole, N., and Marsh, E. J. (2013). Explanation feedback is better than correct answer feedback for promoting transfer of learning. *Journal of Educational Psychology*, 105(2), 290–298.
Butler, A. C., and Roediger, H. L. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. *Memory & Cognition*, 36(3), 604–616.
Butterfield, B., and Metcalfe, J. (2001). Errors committed with high confidence are hypercorrected. *JEP: Learning, Memory, and Cognition*, 27(6), 1491–1494.
Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., and Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380.
Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., and Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science*, 19(11), 1095–1102.
Chi, M. T. H., de Leeuw, N., Chiu, M.-H., and LaVancher, C. (1994). Eliciting self-explanations improves understanding. *Cognitive Science*, 18(3), 439–477.
Chi, M. T. H., Siler, S. A., Jeong, H., Yamauchi, T., and Hausmann, R. G. (2001). Learning from human tutoring. *Cognitive Science*, 25(4), 471–533.
Chi, M. T. H. (2008). Three types of conceptual change. In S. Vosniadou (ed.), *International Handbook of Research on Conceptual Change*. Routledge.
Cowan, N. (2001). The magical number 4 in short-term memory. *Behavioral and Brain Sciences*, 24(1), 87–114.
Diekelmann, S., and Born, J. (2010). The memory function of sleep. *Nature Reviews Neuroscience*, 11(2), 114–126.
Driskell, J. E., Copper, C., and Moran, A. (1994). Does mental practice enhance performance? *Journal of Applied Psychology*, 79(4), 481–492.
Dunlosky, J., and Rawson, K. A. (2012). Overconfidence produces underachievement: Inaccurate self evaluations undermine students' learning and retention. *Learning and Instruction*, 22(4), 271–280.
Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., and Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, 14(1), 4–58.
Ebbinghaus, H. (1885/1913). *Memory: A Contribution to Experimental Psychology*.
Ericsson, K. A., Krampe, R. T., and Tesch-Römer, C. (1993). The role of deliberate practice in the acquisition of expert performance. *Psychological Review*, 100(3), 363–406.
Erten, İ. H., and Tekin, M. (2008). Effects on vocabulary acquisition of presenting new words in semantic sets versus semantically unrelated sets. *System*, 36(3), 407–422.
Finkbeiner, M., and Nicol, J. (2003). Semantic category effects in second language word learning. *Applied Psycholinguistics*, 24(3), 369–383.
Fiorella, L., and Mayer, R. E. (2013). The relative benefits of learning by teaching and teaching expectancy. *Contemporary Educational Psychology*, 38(4), 281–288.
Fiorella, L., and Mayer, R. E. (2016). Eight ways to promote generative learning. *Educational Psychology Review*, 28(4), 717–741.
Gick, M. L., and Holyoak, K. J. (1983). Schema induction and analogical transfer. *Cognitive Psychology*, 15(1), 1–38.
Gollwitzer, P. M., and Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. *Advances in Experimental Social Psychology*, 38, 69–119.
Guadagnoli, M. A., and Lee, T. D. (2004). Challenge point: A framework for conceptualizing the effects of various practice conditions in motor learning. *Journal of Motor Behavior*, 36(2), 212–224.
Harp, S. F., and Mayer, R. E. (1998). How seductive details do their damage. *Journal of Educational Psychology*, 90(3), 414–434.
Hattie, J., and Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112.
Hulleman, C. S., and Harackiewicz, J. M. (2009). Promoting interest and performance in high school science classes. *Science*, 326(5958), 1410–1412.
Kalyuga, S., Ayres, P., Chandler, P., and Sweller, J. (2003). The expertise reversal effect. *Educational Psychologist*, 38(1), 23–31.
Kapur, M. (2008). Productive failure. *Cognition and Instruction*, 26(3), 379–424.
Karpicke, J. D., and Bauernschmidt, A. (2011). Spaced retrieval: Absolute spacing enhances learning regardless of relative spacing. *JEP: Learning, Memory, and Cognition*, 37(5), 1250–1257.
Karpicke, J. D., and Blunt, J. R. (2011). Retrieval practice produces more learning than elaborative studying with concept mapping. *Science*, 331(6018), 772–775.
Kestin, G., Miller, K., Klales, A., Milbourne, T., and Ponti, G. (2025). AI tutoring outperforms in-class active learning: An RCT introducing a novel research-based design in an authentic educational setting. *Scientific Reports*, 15.
Kirschner, P. A., Sweller, J., and Clark, R. E. (2006). Why minimal guidance during instruction does not work. *Educational Psychologist*, 41(2), 75–86.
Kobayashi, K. (2019). Learning by teaching face-to-face: The contributions of preparing-to-teach, initial-explanation, and interaction phases. *British Journal of Educational Psychology*, 89(4).
Koedinger, K. R., Corbett, A. T., and Perfetti, C. (2012). The Knowledge-Learning-Instruction framework. *Cognitive Science*, 36(5), 757–798.
Koedinger, K. R., Carvalho, P. F., Liu, R., and McLaughlin, E. A. (2023). An astonishing regularity in student learning rate. *PNAS*, 120(13).
Koriat, A. (1997). Monitoring one's own knowledge during study: A cue-utilization approach to judgments of learning. *JEP: General*, 126(4), 349–370.
Kornell, N., and Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychological Science*, 19(6), 585–592.
Kornell, N., Hays, M. J., and Bjork, R. A. (2009). Unsuccessful retrieval attempts enhance subsequent learning. *JEP: Learning, Memory, and Cognition*, 35(4), 989–998.
Kulik, C.-L. C., Kulik, J. A., and Bangert-Drowns, R. L. (1990). Effectiveness of mastery learning programs: A meta-analysis. *Review of Educational Research*, 60(2), 265–299.
Kulik, J. A., and Fletcher, J. D. (2016). Effectiveness of intelligent tutoring systems: A meta-analytic review. *Review of Educational Research*, 86(1), 42–78.
Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., and Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. *European Journal of Social Psychology*, 40(6), 998–1009.
Locke, E. A., and Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation. *American Psychologist*, 57(9), 705–717.
Macnamara, B. N., Hambrick, D. Z., and Oswald, F. L. (2014). Deliberate practice and performance in music, games, sports, education, and professions: A meta-analysis. *Psychological Science*, 25(8), 1608–1618.
Mayer, R. E. (2009). *Multimedia Learning* (2nd ed.). Cambridge University Press.
Mayer, R. E., and Moreno, R. (2003). Nine ways to reduce cognitive load in multimedia learning. *Educational Psychologist*, 38(1), 43–52.
Mazza, S., Gerbier, E., Gustin, M.-P., Kasikci, Z., Koenig, O., Toppino, T. C., and Magnin, M. (2016). Relearn faster and retain longer: Along with practice, sleep makes perfect. *Psychological Science*, 27(10), 1321–1330.
Metcalfe, J. (2017). Learning from errors. *Annual Review of Psychology*, 68, 465–489.
Meyer, J. H. F., and Land, R. (2005). Threshold concepts and troublesome knowledge (2): Epistemological considerations and a conceptual framework for teaching and learning. *Higher Education*, 49(3), 373–388.
Nakata, T., and Suzuki, Y. (2019). Effects of massing and spacing on the learning of semantically related and unrelated words. *Studies in Second Language Acquisition*, 41(2), 287–311.
Nation, I. S. P. (2013). *Learning Vocabulary in Another Language* (2nd ed.). Cambridge University Press.
Nelson, T. O., and Dunlosky, J. (1991). When people's judgments of learning (JOLs) are extremely accurate at predicting subsequent recall: The "delayed-JOL effect". *Psychological Science*, 2(4), 267–270.
Pan, S. C., and Rickard, T. C. (2018). Transfer of test-enhanced learning: Meta-analytic review and synthesis. *Psychological Bulletin*, 144(7), 710–756.
Pashler, H., McDaniel, M., Rohrer, D., and Bjork, R. (2008). Learning styles: Concepts and evidence. *Psychological Science in the Public Interest*, 9(3), 105–119.
Posner, G. J., Strike, K. A., Hewson, P. W., and Gertzog, W. A. (1982). Accommodation of a scientific conception: Toward a theory of conceptual change. *Science Education*, 66(2), 211–227.
Pressley, M., McDaniel, M. A., Turnure, J. E., Wood, E., and Ahmad, M. (1987). Generation and precision of elaboration: Effects on intentional and incidental learning. *JEP: Learning, Memory, and Cognition*, 13(2), 291–300.
Rasch, B., and Born, J. (2013). About sleep's role in memory. *Physiological Reviews*, 93(2), 681–766.
Rawson, K. A., and Dunlosky, J. (2011). Optimizing schedules of retrieval practice for durable and efficient learning: How much is enough? *JEP: General*, 140(3), 283–302.
Rawson, K. A., Dunlosky, J., and Sciartelli, S. M. (2013). The power of successive relearning: Improving performance on course exams and long-term retention. *Educational Psychology Review*, 25(4), 523–548.
Renkl, A., and Atkinson, R. K. (2003). Structuring the transition from example study to problem solving in cognitive skill acquisition: A cognitive load perspective. *Educational Psychologist*, 38(1), 15–22.
Richland, L. E., Kornell, N., and Kao, L. S. (2009). The pretesting effect: Do unsuccessful retrieval attempts enhance learning? *JEP: Applied*, 15(3), 243–257.
Roediger, H. L., and Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17(3), 249–255.
Rohrer, D., and Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35(6), 481–498.
Rohrer, D., Dedrick, R. F., and Stershic, S. (2015). Interleaved practice improves mathematics learning. *Journal of Educational Psychology*, 107(3), 900–908.
Rohrer, D., Dedrick, R. F., Hartwig, M. K., and Cheung, C.-N. (2020). A randomized controlled trial of interleaved mathematics practice. *Journal of Educational Psychology*, 112(1), 40–52.
Rosenshine, B. (2012). Principles of instruction: Research-based strategies that all teachers should know. *American Educator*, 36(1), 12–19.
Rowland, C. A. (2014). The effect of testing versus restudy on retention: A meta-analytic review of the testing effect. *Psychological Bulletin*, 140(6), 1432–1463.
Ryan, R. M., and Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. *American Psychologist*, 55(1), 68–78.
Salmoni, A. W., Schmidt, R. A., and Walter, C. B. (1984). Knowledge of results and motor learning: A review and critical reappraisal. *Psychological Bulletin*, 95(3), 355–386.
Schroeder, N. L., and Kucera, A. C. (2022). Refutation text facilitates learning: A meta-analysis of between-subjects experiments. *Educational Psychology Review*, 34, 957–987.
Schwartz, D. L., and Bransford, J. D. (1998). A time for telling. *Cognition and Instruction*, 16(4), 475–522.
Shea, J. B., and Morgan, R. L. (1979). Contextual interference effects on the acquisition, retention, and transfer of a motor skill. *JEP: Human Learning and Memory*, 5(2), 179–187.
Sinha, T., and Kapur, M. (2021). When problem solving followed by instruction works: Evidence for productive failure. *Review of Educational Research*, 91(5), 761–798.
Sisk, V. F., Burgoyne, A. P., Sun, J., Butler, J. L., and Macnamara, B. N. (2018). To what extent and under which circumstances are growth mind-sets important to academic achievement? Two meta-analyses. *Psychological Science*, 29(4), 549–571.
Slamecka, N. J., and Graf, P. (1978). The generation effect: Delineation of a phenomenon. *JEP: Human Learning and Memory*, 4(6), 592–604.
Smolen, P., Zhang, Y., and Byrne, J. H. (2016). The right time to learn: Mechanisms and optimization of spaced learning. *Nature Reviews Neuroscience*, 17(2), 77–88.
Soderstrom, N. C., and Bjork, R. A. (2015). Learning versus performance: An integrative review. *Perspectives on Psychological Science*, 10(2), 176–199.
Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science*, 12(2), 257–285.
Sweller, J., and Cooper, G. A. (1985). The use of worked examples as a substitute for problem solving in learning algebra. *Cognition and Instruction*, 2(1), 59–89.
Sweller, J., van Merriënboer, J. J. G., and Paas, F. (2019). Cognitive architecture and instructional design: 20 years later. *Educational Psychology Review*, 31(2), 261–292.
Tabibian, B., Upadhyay, U., De, A., Zarezade, A., Schölkopf, B., and Gomez-Rodriguez, M. (2019). Enhancing human learning via spaced repetition optimization. *PNAS*, 116(10), 3988–3993.
Tinkham, T. (1993). The effect of semantic clustering on the learning of second language vocabulary. *System*, 21(3), 371–380.
Tinkham, T. (1997). The effects of semantic and thematic clustering on the learning of second language vocabulary. *Second Language Research*, 13(2), 138–163.
Tippett, C. D. (2010). Refutation text in science education: A review of two decades of research. *International Journal of Science and Mathematics Education*, 8(6), 951–970.
van Merriënboer, J. J. G., and Kirschner, P. A. (2018). *Ten Steps to Complex Learning* (3rd ed.). Routledge.
VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist*, 46(4), 197–221.
Vaughn, K. E., and Rawson, K. A. (2011). Diagnosing criterion-level effects on memory: What aspects of memory are enhanced by repeated retrieval? *Psychological Science*, 22(9), 1127–1131.
Walker, M. P., Brakefield, T., Morgan, A., Hobson, J. A., and Stickgold, R. (2002). Practice with sleep makes perfect: Sleep-dependent motor skill learning. *Neuron*, 35(1), 205–211.
Waring, R. (1997). The negative effects of learning words in semantic sets: A replication. *System*, 25(2), 261–274.
Wiggins, G., and McTighe, J. (2005). *Understanding by Design* (2nd ed.). ASCD.
Wilson, R. C., Shenhav, A., Straccia, M., and Cohen, J. D. (2019). The Eighty Five Percent Rule for optimal learning. *Nature Communications*, 10, 4646.
Winstein, C. J., and Schmidt, R. A. (1990). Reduced frequency of knowledge of results enhances motor skill learning. *JEP: Learning, Memory, and Cognition*, 16(4), 677–691.
Wisniewski, B., Zierer, K., and Hattie, J. (2020). The power of feedback revisited: A meta-analysis of educational feedback research. *Frontiers in Psychology*, 10, 3087.
Wulf, G. (2013). Attentional focus and motor learning: A review of 15 years. *International Review of Sport and Exercise Psychology*, 6(1), 77–104.
Wulf, G., and Lewthwaite, R. (2016). Optimizing performance through intrinsic motivation and attention for learning: The OPTIMAL theory of motor learning. *Psychonomic Bulletin & Review*, 23(5), 1382–1414.
Ye, J., Su, J., and Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *Proceedings of the 28th ACM SIGKDD Conference*, 4381–4390.
Yeager, D. S., et al. (2019). A national experiment reveals where a growth mindset improves achievement. *Nature*, 573, 364–369.
