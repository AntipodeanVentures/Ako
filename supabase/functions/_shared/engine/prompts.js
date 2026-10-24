// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

import { arr, clampNum, num, pct, plural, str } from './core.js';
import { BAND_TARGET, CRITERION, LEVEL_PASS, PITCH, ROLE_LEVEL_GOOD, STAGES, START_STAGE, SUPPORT, pitchOf, relearnTarget, stageIdx, stageName, supportOf } from './ladder.js';
import { isLearned, learnerAbout, learnerModel, subjectCards, topicById, topicStatus, weakConcepts } from './progress.js';

// ---------- the method, given to Claude with every request ----------
const METHOD = `Evidence-based method (follow it):
- Retrieval practice: the learner must recall and apply from memory, not reread. Every lesson ends with recall and practice questions.
- Spacing and successive relearning: material is reviewed across days with spaced flashcards and relearned several times, so write cards worth reviewing for months.
- Attempt first: pose a question before teaching; a wrong first attempt helps learning.
- Build on prior knowledge: link each new idea to something the learner already knows, from earlier topics, everyday life or their own fields. Compare two contrasting cases to bring out the principle.
- Worked examples for novices, fading to independent problems as expertise grows.
- Interleave confusable types once the basics are known. New words are learned in small sets grouped by theme or situation (the words of one scene or task), never by semantic category (colours together, fruits together), which causes interference.
- Keep practice in the productive band: roughly four in five answers right, with difficulty rising as the learner succeeds.
- Physical skills: brief demonstration and drilling of a new movement, then varied, game-like practice that keeps the decision in the drill; focus on the effect of the movement rather than the body; reduce feedback as the skill forms; mental rehearsal adds a little to real practice; film yourself and compare.
- Feedback is specific and explains why; prompt the learner to self-correct. Confident mistakes deserve the clearest correction.
- Never use "learning styles". Accuracy matters: if you are not sure of a fact, say so rather than guess.`;

function learnerLines(subj) {
  const about = learnerAbout(subj);
  const known = subj.plan.topics.filter((t) => isLearned(subj, t)).map((t) => t.title).slice(-30).join('; ') || 'none yet';
  const m = subj.model || {};
  const g = learnerModel(subj);
  const lines = [
    `Lesson level: ${PITCH[pitchOf(subj)].text}`,
    `What they know well in other areas: ${about || 'not given'}.`,
    `What they knew about this subject at the start: ${subj.intake.background || 'not given'}.`,
    `Their goal: ${subj.intake.why || 'not given'}.`,
    `Topics already learned in this subject: ${known}.`
  ];
  if (subj.intake.focus) lines.push(`What they most want to aim at: ${subj.intake.focus}.`);
  const qa = arr(subj.intake.answers).filter((x) => x && str(x.a)).slice(0, 4);
  if (qa.length) lines.push(`What they said when they started: ${qa.map((x) => str(x.q, 120) + ' ' + str(x.a, 200)).join(' | ')}.`);
  if (arr(m.strengths).length) lines.push(`Strengths seen so far: ${m.strengths.join('; ')}.`);
  if (arr(m.misconceptions).length) lines.push(`Misconceptions or confusions to watch for: ${m.misconceptions.join('; ')}.`);
  const an = arr(m.analogies).concat(arr(g.analogies)).slice(0, 6);
  if (an.length) lines.push(`Comparisons that have worked for them: ${an.join('; ')}.`);
  if (m.note) lines.push(`Teaching note: ${m.note}`);
  const weak = weakConcepts(subj, 5);
  if (weak.length) lines.push(`Ideas they have struggled with in practice and reviews: ${weak.map((c) => c.name + ' (' + c.ok + ' of ' + c.n + ' right)').join('; ')}.`);
  return lines.join('\n');
}
const stageLines = (plan) => arr(plan.stages).map((s) => `${s.id} ${stageName(s.id)}: ${s.means}${s.equivalent ? ' (usual marker: ' + s.equivalent + ')' : ''}`).join('\n');

const FRAMEWORK_GUIDE = `Anchor the five levels to recognised frameworks, and name the framework you used in "basis" for each level:
- Academic subjects: the UK Framework for Higher Education Qualifications (FHEQ) level descriptors (level 4 Beginner, 5 Capable, 6 Proficient, 7 Advanced, 8 Expert) and the relevant QAA subject benchmark statement, or the closest equivalent elsewhere.
- Languages: CEFR can-do descriptors (roughly A1 to A2 Beginner, B1 Capable, B2 Proficient, C1 Advanced, C2 plus academic or professional mastery Expert).
- Martial arts and sports: the belt or grading syllabus of the main governing body, or competition levels.
- Games with ratings: rating bands (for chess, roughly 1000, 1400, 1800, 2200 and titled strength).
- Professions and trades: licences, professional body curricula and job grades (for aviation, PPL, CPL, ATPL and type ratings, instructor and examiner).
- Where no framework exists, say so in "basis" and describe the levels by what practitioners can do.`;

// The learner's own answers to the intake questions, verbatim, so the plan
// can be shaped around what they said rather than a summary of it.
function intakeLines(intake) {
  const qa = arr(intake && intake.answers).filter((x) => x && str(x.a)).slice(0, 4);
  if (!qa.length) return '';
  return '\nBefore the plan was written the learner was asked the questions below, chosen because the answers change the course, and answered in their own words. Their answers matter more than anything inferred above. Shape the plan around them: put the parts they want first, serve the use they named, follow any material they named, and skip what their background shows they already have:\n' + qa.map((x) => `Q: ${str(x.q, 300)}${x.effect ? ' (asked because: ' + str(x.effect, 240) + ')' : ''}\nA: ${str(x.a, 1200)}`).join('\n') + '\n';
}

function planPrompt(intake, coverTo) {
  const about = str(intake.about, 1600);
  const startIdx = START_STAGE[intake.current] || 0;
  const coverNames = STAGES.slice(startIdx, stageIdx(coverTo) + 1).map((s) => s.id + ' ' + s.name).join(', ');
  const syllabus = str(intake.syllabus, 8000);
  return `You are an expert curriculum designer and learning scientist. Design an accelerated learning plan for one adult learner.

Learner:
- Wants to learn: ${intake.subject}
- Wants to reach: ${stageName(intake.target)} level (see the ladder below)
- Time available: about ${intake.hours} hours per week
- Current level in this subject: ${intake.current}
- What they already know about this subject: ${intake.background || 'not given'}
- What they know well in other areas: ${about || 'not given'}
- What they want to be able to do: ${intake.why || 'not given'}${intake.focus ? '\n- What they most want to aim at: ' + intake.focus : ''}${intake.role ? '\n- The role they are preparing for: ' + intake.role : ''}
${intakeLines(intake)}${syllabus ? '\nReference material supplied by the learner (a syllabus, reading list or course outline). Use it as the backbone of the plan: cover what it covers, keep its order where that makes sense, and add any prerequisite it assumes but does not teach:\n"""\n' + syllabus + '\n"""\n' : ''}
${METHOD}

The ladder. Progress in every subject is tracked against five stages named by what the learner can do; each stage's usual anchors in formal frameworks are given for reference:
${STAGES.map((s) => `- ${s.id} ${s.name}: ${s.blurb} (${s.fheq})`).join('\n')}

${FRAMEWORK_GUIDE}

Design backwards from what the learner must be able to do. Work in this order:
1. "stages": describe all five stages for THIS subject. For each give "means" (what someone at that stage can actually do, in 1 or 2 observable sentences), "basis" (the framework or syllabus it rests on, briefly), "equivalent" (the usual marker people in this field would recognise, or "" if there is none), "outcomes" (3 to 6 can-do statements that the level check at the end of this stage will test; concrete and assessable), "external" (one real-world check the learner could take outside this app to confirm the level, such as a named practice exam, a grading, a rating target or a task a professional would set; or "" if there is none), and "hours": the cumulative study hours from zero that a motivated adult with this learner's background typically needs to reach the stage. Be realistic; higher stages take hundreds to thousands of hours.
2. "topics": write the topics for stages ${coverNames} only, 12 to 30 in total, each learnable in one 20 to 45 minute session. Derive them from the outcomes: every topic must serve at least one outcome of its stage ("outcome" is that outcome's index, 0-based), and every outcome must be served. Each topic covers one core idea and introduces at most 3 to 5 new terms; split anything denser. Tag each topic with its "stage". Order them from the familiar to the unfamiliar: begin with the ideas closest to what the learner already knows and to their goal, then work outward, always with prerequisites first. For a complete beginner, the first 3 topics must need no prior knowledge of the field. Later stages should revisit the core ideas at greater depth rather than treating them as finished. Do not skip fundamentals because of their background: a placement check lets them skip what they already know.
3. Mark the threshold concepts: set "threshold": true on the few topics (at most one in five) that transform how the learner sees the field and unlock what follows; they get more relearning and more comparison cases.
4. Write topic titles and summaries in plain words a newcomer would understand.
5. "milestones": group the topics into 3 to 6 milestones, in order, each tagged with its "stage". A milestone is a capability the learner can demonstrate, with a concrete test.
6. Topic kinds: "concept", "procedure", "vocabulary", "motor" (a physical movement practised away from the screen), "strategy", or "roleplay" (an interpersonal or spoken skill best practised in a live conversation, such as negotiating, giving feedback, interviewing, coaching, or speaking a language; the app runs these as role-plays with Claude playing the other person).
7. Give 4 to 6 method rules adapted to this subject.
8. Recommend 3 to 6 reputable resources (books, courses, tools, channels) by exact title and creator, suited to where the learner is starting. Only include ones you are confident exist. Never write URLs; give a search phrase instead.
9. If the subject has safety, legal or licensing requirements (physical risk, aviation, medicine, regulated finance, electrical work), state them in "safety"; otherwise use an empty array.
10. If the subject is a human language, set "language" to its BCP 47 code (for example "pt-BR"); otherwise null.

Return ONLY JSON, with no commentary, in exactly this shape:
{"title":"short subject name","subjectType":"knowledge","language":null,"summary":"2 sentences on the approach","stages":[{"id":"s1","means":"...","basis":"...","equivalent":"...","outcomes":["can ..."],"external":"...","hours":40},{"id":"s2","means":"...","basis":"...","equivalent":"...","outcomes":["..."],"external":"...","hours":150},{"id":"s3","means":"...","basis":"...","equivalent":"...","outcomes":["..."],"external":"...","hours":600},{"id":"s4","means":"...","basis":"...","equivalent":"...","outcomes":["..."],"external":"...","hours":1500},{"id":"s5","means":"...","basis":"...","equivalent":"...","outcomes":["..."],"external":"...","hours":5000}],"rules":["..."],"milestones":[{"id":"m1","title":"...","test":"how to check it","stage":"s1"}],"topics":[{"id":"t1","title":"...","summary":"at most 20 plain words","kind":"concept","stage":"s1","outcome":0,"threshold":false,"milestone":"m1","prereqs":[],"minutes":30}],"resources":[{"title":"...","creator":"...","type":"book","why":"at most 15 words","search":"search phrase"}],"safety":[]}
"subjectType" is one of "knowledge", "language", "physical", "mixed", "interpersonal". "prereqs" lists earlier topic ids.`;
}

// A second pass: a critic reads the draft plan against the learner and the level definitions and returns a corrected plan.
function reviewPlanPrompt(plan, intake) {
  return `You are reviewing a draft learning plan written for one adult learner, before it is used. Find and fix its weaknesses.

Learner: wants to learn ${intake.subject}; aims for ${stageName(intake.target)} level; starting level: ${intake.current}; knows about the subject: ${intake.background || 'nothing stated'}; knows well elsewhere: ${str(intake.about, 1600) || 'not given'}; goal: ${intake.why || 'not given'}${intake.focus ? '; wants to aim at: ' + intake.focus : ''}.${intakeLines(intake)}${str(intake.syllabus) ? '\nReference material they supplied (the plan should follow it):\n"""\n' + str(intake.syllabus, 6000) + '\n"""' : ''}

Draft plan (JSON):
${JSON.stringify(plan)}

Check, in this order, and correct anything wrong:
1. Prerequisites: does any topic assume an idea or term that no earlier topic teaches? Add the missing topic or reorder.
2. Order: is the sequence familiar to unfamiliar, with the first topics needing no prior knowledge for a beginner?
3. Density: is any topic really two or three ideas, or more than 5 new terms? Split it.
4. Coverage: does every outcome of each covered stage have at least one topic serving it, and does the set of topics genuinely add up to the stage's "means"? Add what is missing; remove padding that serves no outcome.
5. Accuracy: are the stage descriptions, markers, frameworks, hours and resources accurate for this field? Correct anything doubtful; never invent a resource.
6. Level: are the topics pitched for this learner's starting level and background, and do they use their other fields where a comparison genuinely helps?
7. Threshold concepts: are the right few topics marked, at most one in five?
8. Milestones: is each one a whole task the learner could demonstrate (something a practitioner does), with a concrete test, rather than a label for a run of topics? Rewrite any that is not.
9. Revisiting: do later stages return to the core ideas of earlier ones at greater depth, rather than treating them as finished?
10. Vocabulary topics: are new words grouped by theme or situation, not by semantic category (colours, fruits, days of the week together), which slows learning? Regroup any that are.

Return ONLY JSON: the complete corrected plan in exactly the same shape as the draft (every field, all five stages, all topics, ids renumbered in order if you insert or remove topics), plus one extra top-level field "changes": a list of short plain sentences describing each change you made (empty if the draft needed none).`;
}

// Turning a CV, a profile page or short answers into structured items the learner then confirms.
function knowPrompt(material, fromPhoto) {
  const body = fromPhoto ? ' The material is in the attached photo (a CV, a profile page or notes); read it carefully.' : '\n\nMaterial:\n"""\n' + material + '\n"""';
  return `Read what follows about one adult learner and extract what they already know well, so a learning app can build on it.${body}

Extract "items", each with:
- "kind": one of "job" (current or past work, with the field), "qualification" (degrees, professional qualifications, licences, certificates, belts and grades), "language" (spoken languages), "sport" (sports and physical disciplines), "hobby" (serious hobbies and pastimes), "field" (areas of knowledge they clearly know well), "tool" (software, instruments or equipment used regularly).
- "text": a short plain description, under 12 words, specific enough to be useful (for example "Commercial pilot's licence", "Structured finance, 10 years in banking", "Brazilian jiu-jitsu, brown belt").
- "level": for languages, native / fluent / conversational / basic; for sports, the belt, grade or years; for jobs, seniority or years; otherwise "".
Rules: at most 30 items, most useful first; merge duplicates; never include contact details, addresses, dates of birth, references, salary, or anything about health. Do not invent: only what the material states or clearly implies.
Also write "summary": 2 sentences on their strongest areas of knowledge and skill, in plain words.

Return ONLY JSON: {"summary":"...","items":[{"kind":"job","text":"...","level":"..."}]}`;
}
// Suggesting a starting point for a new subject from the confirmed profile.
function startPrompt(subject, about) {
  return `An adult is about to start learning "${subject}". Here is what they already know well:
${str(about, 1600) || '(nothing recorded)'}

Decide a realistic starting point for this subject from that background alone. Return ONLY JSON:
{"current":"one of exactly: Complete beginner | Know a little | Intermediate | Used to be good, now rusty","background":"1 to 3 plain sentences on what in their background bears on this subject, or an empty string if nothing does","why":"one sentence on why you chose that starting point"}`;
}

// Before the plan: the two or three questions whose answers would most change
// this learner's course, chosen by the model for the subject and the learner
// rather than drawn from fixed slots. Each comes with quick answers to tap and
// room to type. The answers steer the plan and every lesson after it.

function intakePrompt(subject, current, target, minutes, about) {
  return `You are an expert tutor meeting a new adult student who wants to learn "${subject}". Before you design their course you may ask at most three short questions. Choose the questions whose answers would most change the course you write: which topics are in it, what comes first, what gets the most time, which examples and practice it uses. Ask nothing you already know and nothing a course would cover anyway.

What you already know:
- Their own rating of where they are now: ${current}
- The level they want to reach: ${stageName(target)}
- Time: about ${minutes} minutes a day
- What they know well in other areas: ${str(about, 1600) || 'not given'}

Ask what an expert in ${subject} would actually ask a new student. For example: the specific situation or use they are aiming at (a trip, an exam, a job, a project, a conversation they want to be able to have, a problem they want to solve); which branch or strand of the subject, when the subject divides into strands that lead to different courses; a book, syllabus, teacher or club they are following; a constraint that shapes practice (equipment, a device, where they will practise); what they have already tried and where it stalled. Pick the two or three that matter most for THIS subject and THIS learner, and ask only one if one is enough. Never ask about time available, their level, or anything in the profile above.

For each question:
- "slot": one of "why" (what for), "focus" (which part), "background" (contact so far), "constraint" (shapes delivery), "material" (something to follow), "other".
- "q": the question, under 25 words, plain British English, no technical terms a newcomer would not know.
- "options": 2 to 5 short answers (under 7 words each) that cover the common cases, so one tap answers it; the learner can always type their own instead. Use [] only where options make no sense (a book title, a date).
- "multi": true if several options could apply at once.
- "effect": one line, for the course writer, on what changes depending on the answer.

Return ONLY JSON: {"questions":[{"slot":"why","q":"...","options":["...","..."],"multi":false,"effect":"..."}]}`;
}

// Revising the path from evidence: what has been mastered, what keeps slipping,
// what a check showed, what the learner asked for. The model returns a bounded
// set of edits to the topics still ahead; normaliseAdaptation applies them.
function adaptPrompt(subj, ctx) {
  const plan = subj.plan;
  const status = (t) => {
    const st = subj.topicState[t.id] || {};
    const s = topicStatus(subj, t);
    return s === 'learning' && num(st.attempts, 0) ? `learning (tried ${st.attempts}x, not yet mastered)` : s;
  };
  const rows = plan.topics.map((t) => `${t.id} | ${t.stage} | ${status(t)} | ${t.title} | ${t.summary}${t.prereqs.length ? ' | needs ' + t.prereqs.join(',') : ''}`).join('\n');
  const covered = Array.from(new Set(plan.topics.map((t) => t.stage)));
  return `You are revising an adult learner's path in "${plan.title}" in the light of evidence. Make the smallest set of changes that would make their next weeks of study more useful; often that is one or two changes, sometimes none.

Why this revision is happening: ${str(ctx.reason, 400)}
${ctx.note ? 'What the learner asked for, in their words: "' + str(ctx.note, 600) + '"\n' : ''}${ctx.evidence ? 'Evidence:\n' + str(ctx.evidence, 3000) + '\n' : ''}
${learnerLines(subj)}

Stages in this subject:
${stageLines(plan)}

Topics (id | stage | status | title | summary | prerequisites), in order:
${rows}

What you may do, at most 6 changes in all:
- "insert": a new topic placed after a given id: a bridging topic before something that keeps slipping, a topic for a use the learner named, a prerequisite that was assumed. Same fields as other topics; only in stages ${covered.join(', ')}; no id.
- "replace": new title, summary and kind for a topic that has not been started, to refocus it on what this learner needs or to narrow one that was too dense.
- "remove": drop a topic that has not been started and serves nothing this learner needs.
- "move": place a topic that has not been started after another id, when the order is wrong for this learner.
Never touch topics that are mastered, known, practising or in learning. Keep every stage's outcomes served. Keep ids as they are. Each change carries "why": one plain sentence to the learner ("you", "your") saying what changed and why.

Return ONLY JSON: {"changes":[{"op":"insert","after":"t7","topic":{"title":"...","summary":"at most 20 plain words","kind":"concept","stage":"s1","outcome":0,"threshold":false,"prereqs":["t7"],"minutes":30},"why":"..."},{"op":"replace","id":"t9","title":"...","summary":"...","kind":"concept","why":"..."},{"op":"remove","id":"t12","why":"..."},{"op":"move","id":"t15","after":"t8","why":"..."}]}
Return {"changes":[]} if the path is right as it stands.`;
}

// A job the learner aspires to, mapped into areas that can each become a subject.
function rolePrompt(title, description, about) {
  return `An adult wants to become good at a particular role. Map what the role needs, so each part can be learned as its own subject.

Role: ${title}
${description ? 'What they told us about it (a job advert, a description, or their own words):\n"""\n' + str(description, 6000) + '\n"""\n' : ''}
What they already know well: ${str(about, 1600) || 'not given'}.

The knowledge ladder used for every subject:
${STAGES.map((s) => `- ${s.id} ${s.name}: ${s.blurb}`).join('\n')}

Write:
- "summary": 2 sentences on what being good at this role actually involves day to day.
- "areas": 5 to 9 areas of knowledge, skill or interpersonal ability the role needs, in priority order. For each: "title" (a subject name that could be typed into a course planner, such as "Financial modelling for infrastructure" or "Giving difficult feedback"), "kind" ("knowledge", "skill" or "interpersonal"), "level" (the ladder stage needed to be GOOD at the role, not the minimum to be hired: s1 to s5), and "why" (one sentence on how the role uses it). Interpersonal areas are practised in the app as role-plays, so phrase them as things a person does in conversation.
- For each area, "have": true only when what they already know clearly covers it at the level needed (say why in "haveWhy", under 15 words); otherwise false and "".
- "evidence": 3 to 6 things employers or clients in this role usually look for beyond knowledge (qualifications, licences, a portfolio, experience, a network), as short items, each as {"text":"...","done":true or false,"why":"under 12 words, when done is true"} judged against what they already know.
- "firstSteps": 2 or 3 sentences on where this particular person should start given what they already know.

Return ONLY JSON: {"summary":"...","areas":[{"title":"...","kind":"knowledge","level":"s3","why":"...","have":false,"haveWhy":""}],"evidence":[{"text":"...","done":false,"why":""}],"firstSteps":"..."}`;
}

// After a role-play, the transcript is judged against the scenario's criteria.
function debriefPrompt(subj, topic, scenario, transcript) {
  return `You are debriefing an adult learner of ${subj.plan.title} after a practice role-play for the topic "${topic.title}".

Scenario: ${scenario.setting}
The learner played: ${scenario.yourRole}. Claude played: ${scenario.claudeRole}.
Goal for the learner: ${scenario.goal}
Criteria for doing it well:
${scenario.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Transcript (Learner and Partner turns):
${transcript}

Judge the learner's turns only. For each criterion give "score": 1 if clearly met, 0.5 if partly, 0 if not. Then write "feedback": 3 to 5 plain sentences to the learner, as "you": what worked, the one change that would make the biggest difference, and a concrete line they could have used. Be specific and quote their own words where useful. If the transcript is too short to judge, score what you can and say so.

Return ONLY JSON: {"scores":[1,0.5,0],"feedback":"..."}`;
}

// A photo of the learner's form, judged against the drill's checks.
function formCheckPrompt(subj, topic, drill) {
  return `The learner of ${subj.plan.title} has sent a photo of themselves practising "${topic.title}". The drill's checks for a good repetition are:
${arr(drill && drill.checks).map((c, i) => `${i + 1}. ${c}`).join('\n') || '(none given)'}
${arr(drill && drill.cues).length ? 'Attention cues: ' + drill.cues.join('; ') : ''}

Look at the photo. In plain words, 4 to 6 sentences: what looks right, what to adjust first and how, and which check it relates to. Judge only what a single still frame can show, and say so where it cannot. Give no medical advice. If the photo does not show the movement or is unclear, say what to photograph instead. Plain text only.`;
}

function extendPrompt(subj, stageId) {
  const plan = subj.plan;
  const existing = plan.topics.map((t) => `${t.id} (${t.stage}) ${t.title}`).join('\n');
  const st = arr(plan.stages).find((x) => x.id === stageId) || {};
  return `Extend an adult learner's plan in "${plan.title}" to the next stage of the knowledge ladder.

Stages for this subject:
${stageLines(plan)}

The outcomes the ${stageName(stageId)} level check will test:
${arr(st.outcomes).map((o, i) => i + ': ' + o).join('\n') || '(none recorded; derive sensible ones from the stage description)'}

Topics already in the plan (id, stage, title):
${existing}

${learnerLines(subj)}

${METHOD}

Write the topics for stage ${stageId} ${stageName(stageId)} only: 10 to 20 topics, each one core idea learnable in 20 to 45 minutes with at most 3 to 5 new terms, ordered from the familiar to the unfamiliar with prerequisites first, every outcome served ("outcome" is its index), and the core ideas of earlier stages revisited at greater depth where they matter. Mark at most one in five topics "threshold": true. "prereqs" may name existing topic ids or new ones. Group them into 2 to 4 milestones, each a capability with a concrete test. Number new topic ids from t${plan.topics.length + 1} and milestone ids from m${plan.milestones.length + 1}. Topic kinds: "concept", "procedure", "vocabulary", "motor", "strategy" or "roleplay".

Return ONLY JSON: {"milestones":[{"id":"m9","title":"...","test":"...","stage":"${stageId}"}],"topics":[{"id":"t31","title":"...","summary":"at most 20 plain words","kind":"concept","stage":"${stageId}","outcome":0,"threshold":false,"milestone":"m9","prereqs":["t12"],"minutes":35}]}`;
}

function placementPrompt(subj) {
  const topics = subj.plan.topics.map((t) => `${t.id} | ${t.stage} | ${t.title} | ${t.summary}`).join('\n');
  return `Write a short placement check for an adult learner of "${subj.plan.title}". Its purpose is to find which topics in this plan they already know, so they can skip them, and so the app can tell which stage of the knowledge ladder they have already reached.

Topics (id | stage | title | summary), in learning order:
${topics}

Learner's own description of their background: ${subj.intake.background || 'not given'}. Current level: ${subj.intake.current}.
What they know well in other areas: ${learnerAbout(subj) || 'not given'}. Where that shows a qualification or job that covers a topic, ask about that topic directly so they can be placed out of it.

Write 8 to 10 questions spread across the plan from basic to advanced, each testing one topic, covering every stage present. Prefer questions that need real understanding over trivia. Use plain words, and start with questions a newcomer could reason out. Use "mcq" (4 options, exactly one correct) for about half and "short" (answered in a sentence or a few words) for the rest. For a physical skill, ask about key details, positions or safety points that someone who had practised it would know.

Return ONLY JSON: {"questions":[{"topicId":"t3","type":"mcq","prompt":"...","options":["...","...","...","..."],"answer":1,"explanation":"..."},{"topicId":"t7","type":"short","prompt":"...","answer":"model answer","explanation":"..."}]}
For "mcq", "answer" is the 0-based index of the correct option.`;
}

function warmupPrompt(subj, topic) {
  return `Write the warm-up for an adult about to learn one topic: two short questions they answer before any teaching. The questions wake up what they already know and get a first guess down, so the lesson can build on it or correct it. A question that is hard to read defeats that purpose, so clarity comes first.

Subject: ${subj.plan.title}. This topic: "${topic.title}". ${topic.summary}
${learnerLines(subj)}

Rules for each question:
- Ask one thing. One question mark. Never "A or B, and say why".
- At most 28 words in all. If it needs a setup, one concrete everyday situation in one short sentence.
- Plain words; no technical term the learner has not met in an earlier topic. Every number has its unit.
- A newcomer understands what is being asked on the first read.
- Speak to the learner as "you".

Question 1, "purpose": "prior". Draws on what they already know from everyday life, an earlier topic or one of their own fields, where the link is natural; do not force one. "type": "short", answered in a sentence.
Question 2, "purpose": "predict". Asks them to guess the core idea of this topic. "type": "choice" with "options": 3 short options (at most 8 words each), exactly one right, the other two being what people commonly believe instead; if a listed misconception bears on this topic, make it one of them. "answer" is the 0-based index of the right option.
Each question has "a": the model answer in one or two plain sentences, enough for a grader to judge a guess against.

"hook": one sentence of at most 18 words that makes this topic worth ten minutes: something surprising, or a use they will recognise. A statement, not a question. Do not give the answer away. No technical terms.

The standard, from a topic on power versus energy:
Too much at once: "Think of your home electricity bill, or a phone charger. What do you think the bill is actually charging you for: how hard your appliances pull at one moment, or how much they used over time? Say why in a sentence or two."
Right: {"q":"A kettle runs for three minutes a day; a fridge hums all day. Which adds more to your bill?","a":"The fridge: it uses less power at any moment, but for far longer, so it uses more energy overall.","purpose":"prior","type":"short"}
Right: {"q":"A solar panel is labelled 5 kW. What does that number describe?","options":["How much electricity it makes in a day","How fast it can make electricity at its best","How much electricity it has made so far"],"answer":1,"a":"The kW figure is a rate: how fast the panel makes electricity in full sun. Electricity made over time is measured in kWh.","purpose":"predict","type":"choice"}

Return ONLY JSON: {"hook":"...","questions":[{"q":"...","a":"...","purpose":"prior","type":"short"},{"q":"...","options":["...","...","..."],"answer":0,"a":"...","purpose":"predict","type":"choice"}]}`;
}

function lessonPrompt(subj, topic, ctx) {
  const c = ctx || {};
  const plan = subj.plan;
  const P = PITCH[pitchOf(subj)];
  const sup = SUPPORT[supportOf(subj)];
  const prereqs = topic.prereqs.map((id) => (topicById(subj, id) || {}).title).filter(Boolean).join('; ') || 'none';
  const warm = c.warm && arr(c.warm.questions).length ? c.warm.questions.map((q, i) => {
    const a = str(c.answers && c.answers[i] && c.answers[i].text, 1500);
    return `Question: ${q.q}\nTheir answer: ${a || '(left blank: they did not know)'}\nModel answer: ${q.a}`;
  }).join('\n\n') : '';
  const motor = topic.kind === 'motor';
  const roleplay = topic.kind === 'roleplay';
  const procedural = topic.kind === 'procedure' || topic.kind === 'strategy' || motor;
  const st = arr(plan.stages).find((x) => x.id === topic.stage) || {};
  const outcome = topic.outcome != null && arr(st.outcomes)[topic.outcome] ? st.outcomes[topic.outcome] : '';
  const earlier = plan.topics.filter((t) => isLearned(subj, t) && t.id !== topic.id).map((t) => t.title).slice(-8);
  return `Teach one topic to an adult learner, using the method below.

Subject: ${plan.title}. Stage of the ladder this topic belongs to: ${topic.stage} ${stageName(topic.stage)}.${outcome ? ' It serves this level outcome: "' + outcome + '".' : ''}${topic.threshold ? ' This is a THRESHOLD concept: it changes how the learner sees the field, so give it two comparison cases, extra concrete examples and a why question that gets at the mechanism.' : ''}
${learnerLines(subj)}
This topic: "${topic.title}" (kind: ${topic.kind}). ${topic.summary}
Builds on: ${prereqs}.
Rules for this subject: ${plan.rules.join(' ')}
${plan.language ? 'This is a language course (' + plan.language + '). Give target-language examples with English translations.' : ''}
${warm ? '\nJust before this lesson they answered a warm-up in their own words:\n\n' + warm + '\n' : ''}${c.simpler ? '\nThey found an earlier version of this lesson too hard. Its sections were: ' + c.simpler.join('; ') + '. Write a simpler version, with smaller steps, fewer new terms and more everyday comparisons.\n' : ''}${c.relearn ? '\nThey learned this topic before, but their reviews show it did not stick' + (typeof c.relearn === 'string' && c.relearn !== 'true' ? ' (' + str(c.relearn, 300) + ')' : '') + '. Teach it again from a different angle: a new comparison, a new worked example, and practice that targets exactly what was forgotten, rather than repeating the first lesson.\n' : ''}
${METHOD}

How to teach this learner:
- Start from what they already know.${warm ? ' In the first section, say in a sentence what their warm-up answers got right, correct any misunderstanding directly, and build from there. Where they did not know, start from the very basics.' : ''}
- Link each new idea to something they already know: an earlier topic, everyday life, or one of their own fields. When a comparison from their world fits, use it and say where it stops working. Do not force one.
- Teach the simplest accurate version first, and add detail only as far as the lesson level allows.
- If a listed misconception or a struggled-with idea touches this topic, address it explicitly and early: name the confusion in plain words, show why it is tempting and where it breaks, and test it in practice. Do not let a known confusion pass unmentioned into new material.
- Introduce at most ${P.terms} new technical terms in this lesson, and explain each in plain words the moment it first appears. Leave out terms they do not need yet.
- Keep paragraphs to 2 to 4 sentences, with one idea per section.
- Support level: ${sup.text}

Produce:
- "concepts": the 2 to 4 ideas this lesson teaches, as short names (under 8 words each). Every practice question and card below points at one of them by index ("concept").
- "bridge": 1 or 2 sentences connecting this topic to something they already know (their warm-up answer, an earlier topic or one of their own fields). It is shown first, under the heading "Building on what you know".
- "compare": ${topic.kind === 'vocabulary' ? 'null.' : 'two short contrasting cases (3 to 5 sentences each) that both involve the core idea but differ in a way that reveals it, as {"a":"...","b":"...","question":"What do these two have in common, and what makes the difference?","answer":"the principle in 2 or 3 plain sentences"}. The learner compares them before reading the sections.'}
- "sections": 2 to 4 short teaching sections, ${P.words} words in total. Each has "heading", "paragraphs" (array of strings) and optional "points" (array of short strings).
- "workedExample": ${procedural || topic.kind === 'concept' ? 'a worked example as {"problem":"...","steps":["..."],"gaps":[indices of steps the learner should complete themselves, per the support level, or []],"answer":"..."}. Each step states what is done and why.' : 'null.'}
- "mistakes": 1 to 3 common mistakes, one sentence each.
- "scenario": ${roleplay ? 'required. A live role-play the learner will do with Claude playing the other person, as {"setting":"where and what is happening, 2 sentences","yourRole":"who the learner is","claudeRole":"who Claude plays, with a disposition that creates realistic difficulty","goal":"what the learner must achieve in the conversation","criteria":["3 to 5 observable things a skilled person would do, used to mark the debrief"],"opener":"the first line Claude says, in character"}' + (plan.language ? ' Conduct it in the target language, with the learner expected to reply in it.' : '') : 'null.'}
- "drill": ${motor ? 'required. Practice away from the screen, as {"steps":["..."],"dose":"sets, reps or minutes","checks":["3 criteria for a good repetition"],"cues":["2 or 3 external-focus cues: what effect to aim for, not which body part to move"],"feedback":"how often to check form, reducing as it improves","imagery":"a 60-second mental rehearsal script","safety":"..."}' : 'null'}.
- "resources": 0 to 2 specific resources for this topic that suit their level, as {"title":"...","creator":"...","search":"search phrase"}. Never write URLs.

Return ONLY JSON in this shape:
{"concepts":["...","..."],"bridge":"...","compare":null,"sections":[{"heading":"...","paragraphs":["..."],"points":["..."]}],"workedExample":null,"mistakes":["..."],"drill":null,"scenario":null,"resources":[]}`;
}

// The retrieval and practice set is written after the lesson text, from the lesson text, so
// every question is answerable from what was actually taught. It runs while the learner reads.
function practicePrompt(subj, topic, lesson, ctx) {
  const c = ctx || {};
  const plan = subj.plan;
  const P = PITCH[pitchOf(subj)];
  const warm = c.warm && arr(c.warm.questions).length ? c.warm.questions.map((q, i) => {
    const a = str(c.answers && c.answers[i] && c.answers[i].text, 800);
    return `Question: ${q.q}\nTheir answer: ${a || '(left blank)'}\nModel answer: ${q.a}`;
  }).join('\n\n') : '';
  const motor = topic.kind === 'motor';
  const earlier = plan.topics.filter((t) => isLearned(subj, t) && t.id !== topic.id).map((t) => t.title).slice(-8);
  const body = arr(lesson && lesson.sections).map((x) => `${x.heading}: ${arr(x.paragraphs).join(' ')}${arr(x.points).length ? ' Points: ' + x.points.join('; ') : ''}`).join('\n').slice(0, 6000);
  return `Write the recall and practice set for a lesson an adult learner has just read, in ${plan.title}. They answer from memory, so every question must be answerable from this lesson and earlier topics only, and use only their terms.

Topic: "${topic.title}" (kind: ${topic.kind}). Lesson level: ${P.text}
${plan.language ? 'This is a language course (' + plan.language + '). Include translation in both directions.' : ''}
The lesson's concepts, by index: ${arr(lesson && lesson.concepts).map((d, i) => i + ': ' + d).join('; ') || 'not recorded'}.
${lesson && lesson.bridge ? 'Opening: ' + str(lesson.bridge, 500) + '\n' : ''}What the lesson taught:
${body}
${arr(lesson && lesson.mistakes).length ? 'Common mistakes it named: ' + lesson.mistakes.join(' ') + '\n' : ''}${warm ? '\nTheir warm-up answers before the lesson:\n\n' + warm + '\n\nWhere an answer showed a misunderstanding, one practice question must test exactly that.\n' : ''}
${METHOD}

Produce:
- "recall": one question asking them to explain the core idea from memory in their own words and link it to something they already know, with "recallAnswer", a model answer of 2 to 4 sentences in plain words.
- "why": one "why" question that makes them explain the reason behind the core idea or a step (not a definition), with "whyAnswer", 1 to 3 sentences.
- "practice": 6 questions. Tag each with "difficulty" from 1 (recognise the idea) to 5 (apply it in a new situation with a twist), including at least one each of 1 or 2, 3, and 4 or 5, and with "concept" (the index of the concept it tests); every concept is tested at least once, and the main one at least twice. Mix "mcq" (4 options, one correct; "answer" is its 0-based index) and "short" (model answer in "answer").${earlier.length ? ' Make 2 of the 6 "mix": true questions that set this topic against earlier topics (' + earlier.join('; ') + '), so the learner must tell them apart or combine them; the rest test this topic alone.' : ''}${motor ? ' Include 2 "decision" questions: a short scenario from live practice and the question "what do you do next and why", as "short" questions with "kind":"decision".' : ''} Each has a one-sentence "explanation" that says why the right answer is right.
- "cards": 4 to 6 flashcards for spaced review over the coming months. One idea per card, each with "concept". "front" is a question or prompt, "back" a short answer. Favour why, how and when over trivia. Each card also has "variants": two other fronts with the same back, so a review tests the idea rather than the wording: one asks it in different words, one gives a two-sentence situation in which the back is the answer.
- "heldBack": 4 questions the learner will never see in this lesson. They are asked weeks from now to find out whether the idea stayed learned, so each sets the idea in a situation unlike the lesson's examples and unlike the practice questions. Two "mcq" and two "short", difficulty 3 or 4, each with "concept" and a one-sentence "explanation".

Return ONLY JSON: {"recall":"...","recallAnswer":"...","why":"...","whyAnswer":"...","practice":[{"type":"mcq","difficulty":1,"concept":0,"mix":false,"prompt":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."},{"type":"short","difficulty":3,"concept":1,"mix":false,"prompt":"...","answer":"...","explanation":"..."}],"cards":[{"front":"...","back":"...","concept":0,"variants":["...","..."]}],"heldBack":[{"type":"mcq","difficulty":3,"concept":0,"prompt":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."},{"type":"short","difficulty":4,"concept":1,"prompt":"...","answer":"...","explanation":"..."}]}`;
}

// Mixed practice: a weekly set across several learned topics, where each question needs two of them
// told apart or combined. One-topic practice never builds that discrimination.
function mixedPrompt(subj, topics) {
  const P = PITCH[pitchOf(subj)];
  const list = topics.map((t) => `${t.id} | ${t.title} | ${t.summary}`).join('\n');
  const weak = weakConcepts(subj, 4).filter((c) => topics.some((t) => t.id === c.tid)).map((c) => c.name + ' (' + c.ok + ' of ' + c.n + ' right)');
  return `Write a mixed practice set for an adult learner of ${subj.plan.title}, across topics they learned over the past weeks. Lesson level: ${P.text}
${subj.plan.language ? 'This is a language course (' + subj.plan.language + '). Include translation in both directions.' : ''}
Topics (id | title | summary):
${list}
${weak.length ? 'Ideas that slip for this learner: ' + weak.join('; ') + '.\n' : ''}
${METHOD}

Write 8 questions. Each one requires telling two of these topics apart, or combining them, in a situation the lessons did not use; none can be answered by recognising which topic it belongs to. Spread them across the topics. Mix "mcq" (4 options, one correct; "answer" is its 0-based index) and "short" (model answer in "answer"), difficulty 3 or 4. Each has "topicId" (the topic it mainly tests), "concept": null, and a one-sentence "explanation" that says why the right answer is right and names the topic it came from. Use only ideas and terms from these topics and earlier ones.

Return ONLY JSON: {"questions":[{"topicId":"t3","type":"mcq","difficulty":3,"prompt":"...","options":["...","...","...","..."],"answer":1,"explanation":"..."},{"topicId":"t7","type":"short","difficulty":4,"prompt":"...","answer":"...","explanation":"..."}]}`;
}

// The opening of the lesson, written after the warm-up so it answers what the learner just said.
function bridgePrompt(subj, topic, lesson, ctx) {
  const c = ctx || {};
  const warm = c.warm && arr(c.warm.questions).length ? c.warm.questions.map((q, i) => {
    const a = str(c.answers && c.answers[i] && c.answers[i].text, 800);
    return `Question: ${q.q}\nTheir answer: ${a || '(left blank: they did not know)'}\nModel answer: ${q.a}`;
  }).join('\n\n') : '';
  return `An adult learning ${subj.plan.title} has just answered a warm-up and is about to read a lesson on "${topic.title}". The lesson teaches: ${arr(lesson && lesson.concepts).join('; ') || topic.summary}.

Their warm-up:

${warm}

Write "bridge": one or two sentences, at most 45 words, shown first under the heading "Building on what you know". Say in plain words what their answers got right, correct any misunderstanding directly and without fuss, and lead into what the lesson teaches. Speak to them as "you". Where they did not know, say what the lesson starts from. No praise padding, no technical terms they have not met.

Return ONLY JSON: {"bridge":"..."}`;
}

function morePracticePrompt(subj, topic, lesson, used, ability) {
  const a = clampNum(Math.round(ability), 1, 5);
  const band = [Math.max(1, a - 1), a, Math.min(5, a + 1)];
  return `An adult learner of ${subj.plan.title} is practising the topic "${topic.title}" (${topic.summary}). They have not yet reached the mastery criterion.

Lesson key points: ${lessonDigest(lesson)}
Lesson level: ${PITCH[pitchOf(subj)].text}
They are currently working at difficulty ${a} on a 1 to 5 scale (1 recognise the idea, 5 apply it in a new situation with a twist).

Questions they have already seen (do not repeat these):
${used.map((q) => '- ' + q).join('\n')}

${METHOD}

The lesson's concepts, by index: ${arr(lesson.concepts).map((c, i) => i + ': ' + c).join('; ') || 'not recorded'}.

Write 4 new practice questions on this topic at difficulties ${band.join(', ')} and ${band[1]}, mixing "mcq" (4 options, one correct; "answer" is its 0-based index) and "short" (model answer in "answer"). Use only ideas and terms from the lesson. Each has "difficulty", "concept" (index) and a one-sentence "explanation" of why the right answer is right.

Return ONLY JSON: {"practice":[{"type":"short","difficulty":${band[0]},"concept":0,"prompt":"...","answer":"...","explanation":"..."}]}`;
}

function gradePrompt(title, items, mode) {
  const warm = mode === 'warmup';
  const confText = { sure: 'sure', unsure: 'unsure', guess: 'guessing' };
  return `You are grading a learner's answers in ${title}. ${warm ? 'These questions were asked before any teaching, to find out what the learner already knows, so guesses are expected. Judge the idea, not the vocabulary.' : 'Be fair, and strict about facts.'}
For each item give "score": 1 if the answer captures the essential idea (wording may differ), 0.5 if it is partly right or misses a key element, 0 if it is wrong or blank. Then "feedback": ${warm
    ? 'one or two short, plain sentences to the learner, as "you". Start by saying whether they were right, partly right or not right, then say what they got right and the one thing to add or correct. No jargon.'
    : 'two or three sentences to the learner, as "you": what was right, what was missing or wrong, and WHY the correct answer is correct, so the reasoning transfers to new cases. Do not repeat the whole model answer. If the learner said they were sure and the answer is wrong, make the correction explicit and memorable, and name the likely confusion.'}

${items.map((it, i) => `Item ${i + 1}
Question: ${it.prompt}
Model answer: ${it.answer}
Learner's answer: ${it.response ? it.response : '(blank)'}${it.conf ? '\nLearner said they were: ' + (confText[it.conf] || it.conf) : ''}`).join('\n\n')}

Return ONLY JSON: {"results":[{"score":1,"feedback":"..."}]} with exactly one result per item, in order.`;
}

function checkPrompt(subj, topics, stageId) {
  const list = topics.map((t) => `${t.id} | ${t.title}${t.threshold ? ' (threshold concept: always include)' : ''} | ${t.summary}`).join('\n');
  const cards = subjectCards(subj).filter((c) => topics.some((t) => t.id === c.topicId)).slice(0, 40).map((c) => `- ${c.front} => ${c.back}`).join('\n');
  const st = stageId ? arr(subj.plan.stages).find((x) => x.id === stageId) || {} : null;
  const weak = weakConcepts(subj, 5).filter((c) => topics.some((t) => t.id === c.tid));
  return `Write a delayed retention check for an adult learning "${subj.plan.title}". It is taken from memory, with no notes and no hints, at least 3 days after these topics were learned.${st ? ' This is the ' + stageName(stageId) + ' LEVEL CHECK: passing it (' + pct(LEVEL_PASS) + ') marks the level as reached, so it must test the level outcomes below, each at least once.' : ''}
${st && arr(st.outcomes).length ? '\nLevel outcomes to test:\n' + st.outcomes.map((o, i) => (i + 1) + '. ' + o).join('\n') + '\n' : ''}${weak.length ? '\nIdeas the learner has struggled with (probe these): ' + weak.map((c) => c.name).join('; ') + '.\n' : ''}
Topics (id | title | summary):
${list}

Some of the learner's review cards, for reference. Do not copy them; test the same knowledge in new wording or new situations:
${cards || '(none)'}

Lesson level: ${PITCH[pitchOf(subj)].text} Use only ideas and terms these topics taught.

Write ${st ? '8 to 10' : '8'} questions spread across the topics (at least 4 even if there are few topics). Favour application and explanation over recognition: about one third "mcq" (4 options, exactly one correct), the rest "short". Include at least one question that makes the learner combine two topics.

Return ONLY JSON: {"questions":[{"topicId":"t2","type":"short","prompt":"...","answer":"model answer","explanation":"..."},{"topicId":"t5","type":"mcq","prompt":"...","options":["...","...","...","..."],"answer":2,"explanation":"..."}]}`;
}

// After each topic, Claude updates a short profile of the learner from what actually happened. It is fed into every later prompt.
function modelPrompt(subj, topic, ev) {
  const m = subj.model || {};
  return `Update a short learner profile for an adult learning ${subj.plan.title}, from what happened while they learned the topic "${topic.title}".

Current profile:
- strengths: ${arr(m.strengths).join('; ') || 'none recorded'}
- misconceptions: ${arr(m.misconceptions).join('; ') || 'none recorded'}
- comparisons that worked: ${arr(m.analogies).join('; ') || 'none recorded'}
- teaching note: ${m.note || 'none'}
What they know well in other areas: ${learnerAbout(subj) || 'not given'}.
Ideas they have struggled with so far (from practice and reviews): ${weakConcepts(subj, 6).map((c) => c.name + ' ' + c.ok + '/' + c.n).join('; ') || 'none yet'}.

What happened in this topic:
${ev}

Write the updated profile. Keep what is still true, drop what this topic contradicts, add what it showed. Each list has at most 5 short items (under 15 words each). "misconceptions" are specific confusions seen in their answers, not general weaknesses. "analogies" are comparisons from their own life or fields that clearly helped. "note" is at most 50 words of advice for teaching this person next time (pace, examples, what to check).

Return ONLY JSON: {"strengths":["..."],"misconceptions":["..."],"analogies":["..."],"note":"..."}`;
}

function tutorRules(subj, topic, lesson, mode, scenario) {
  const about = learnerAbout(subj);
  const level = `Explain at this level: ${PITCH[pitchOf(subj)].text}`;
  if (mode === 'roleplay' && scenario) {
    return `You are running a practice role-play for an adult learner of ${subj.plan.title}, topic "${topic ? topic.title : ''}".
Setting: ${scenario.setting}
The learner plays: ${scenario.yourRole}. You play: ${scenario.claudeRole}.
The learner's goal: ${scenario.goal}
What a skilled person would do (do not reveal; the debrief uses it): ${scenario.criteria.join('; ')}
${subj.plan.language ? 'Conduct the conversation in ' + subj.plan.language + '. If the learner writes in English, reply in the target language and keep it simple.' : ''}
How to run it:
- Stay fully in character as ${scenario.claudeRole}. Reply in 1 to 3 short sentences, as that person would speak, with the disposition described. Never coach, praise or explain during the role-play.
- React realistically to what the learner actually says: if they do well, soften; if they miss something, push back or stay stuck, as that person would.
- If the learner says "pause" or asks for help, step out of character for one sentence of hint, then resume.
- Plain text only. No stage directions longer than a few words.
Reply to the learner's latest turn.`;
  }
  if (mode === 'student') {
    return `You are role-playing a curious beginner who knows nothing about ${subj.plan.title}. The person you are talking to has just learned ${topic ? '"' + topic.title + '"' : 'a topic'} and is practising teaching it to you, because explaining something to a novice is one of the best ways to learn it.
${lesson ? 'What a correct explanation should contain (do not reveal this): ' + lessonDigest(lesson) + ' Model answer to the core question: ' + str(lesson.recallAnswer, 600) : ''}
How to behave:
- Stay in character as the beginner. Ask one naive, genuine question at a time, under 60 words, the kind a newcomer would ask ("why does that happen?", "what would happen if...?", "can you give me an everyday example?").
- If their explanation has a gap or an error, do not correct it. Ask a question that makes them notice it.
- Ask for an example or a comparison from everyday life when they stay abstract.
- After about 3 exchanges, or if they say they are done, drop the role for one short paragraph: say what was clear, what was shaky or wrong, and one thing to make the explanation better.
- Plain text only.
Reply to their latest message.`;
  }
  const m = subj.model || {};
  return `You are a patient expert tutor in ${subj.plan.title}. The learner is an adult working on ${topic ? '"' + topic.title + '"' : 'the subject in general'}. They are aiming for ${stageName(subj.intake.target)} level.
${level}
${about ? 'What they know well in other areas: ' + about + '. Use comparisons from these when they genuinely help.' : ''}
${arr(m.misconceptions).length ? 'Confusions seen in their earlier answers: ' + m.misconceptions.join('; ') + '.' : ''}
${arr(m.analogies).length ? 'Comparisons that have worked for them: ' + m.analogies.join('; ') + '.' : ''}
${m.note ? 'Teaching note: ' + m.note : ''}
${lesson ? 'Lesson key points: ' + lessonDigest(lesson) : ''}
How to tutor:
- Ask one question at a time and keep replies under 120 words.
- When the learner is stuck, give the smallest useful hint, not the answer.
- Give a full answer only after the learner has made a real attempt, or asks for it twice.
- Ask them to explain their reasoning. Correct misconceptions directly and say why.
- Use concrete examples. If you are not sure of a fact, say so.
- Plain text only, no markdown headings or tables.
Reply to the learner's latest message.`;
}

function lessonDigest(lesson) {
  if (!lesson) return '';
  const pts = [];
  for (const sec of lesson.sections || []) { pts.push(sec.heading); for (const p of (sec.points || []).slice(0, 4)) pts.push(p); }
  return pts.filter(Boolean).join('; ').slice(0, 1500);
}

export { METHOD, intakePrompt, intakeLines, adaptPrompt, learnerLines, stageLines, FRAMEWORK_GUIDE, planPrompt, reviewPlanPrompt, knowPrompt, startPrompt, rolePrompt, debriefPrompt, formCheckPrompt, extendPrompt, placementPrompt, warmupPrompt, lessonPrompt, practicePrompt, bridgePrompt, mixedPrompt, morePracticePrompt, gradePrompt, checkPrompt, modelPrompt, tutorRules, lessonDigest };
