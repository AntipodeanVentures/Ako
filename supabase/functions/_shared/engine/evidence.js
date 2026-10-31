// The evidence ledger: each principle the method rests on, the engine constants and prompt phrases that
// implement it, and the papers behind it. docs/evidence-base.md is the readable form; the test in
// __tests__/evidence.test.js fails when a constant or prompt drifts from this ledger, and names the paper.
//
// Keep entries short. "params" are checked for equality against the engine; "prompts" are substrings
// that must appear in the named prompt builder's output; "sources" are author-year keys into the
// reading list in docs/evidence-base.md.

const DAY = 86400000;

export const EVIDENCE = [
  {
    id: 'retrieval',
    principle: 'Retrieval practice beats restudy, for retention and transfer',
    sources: ['Roediger & Karpicke 2006', 'Rowland 2014', 'Pan & Rickard 2018', 'Dunlosky et al. 2013'],
    prompts: { METHOD: ['Retrieval practice: the learner must recall and apply from memory, not reread'], practicePrompt: ['"recall"', '"why"', '6 questions'] },
  },
  {
    id: 'spacing',
    principle: 'Spaced review on a fitted memory model; delayed probes at about three weeks, then five weeks on',
    sources: ['Cepeda et al. 2006', 'Cepeda et al. 2008', 'Ye, Su & Cao 2022', 'Karpicke & Bauernschmidt 2011'],
    params: { RETENTION_DEFAULT: 0.9, PROBE_FIRST_DAYS: 14, PROBE_FIRST_TARGET: 21, PROBE_SECOND_GAP: 35 },
  },
  {
    id: 'relearning',
    principle: 'Three correct recalls in the sitting, then three spaced relearning sessions; poor retention tightens spacing, not the sitting bar',
    sources: ['Rawson & Dunlosky 2011', 'Rawson, Dunlosky & Sciartelli 2013', 'Vaughn & Rawson 2011'],
    params: { CRITERION: 3, RELEARN_TARGET: 3, CALIBRATION_TIGHT: 0.93, CALIBRATION_TIGHTER: 0.95 },
  },
  {
    id: 'band',
    principle: 'Practice in the productive band: about four in five right, difficulty rising with success',
    sources: ['Bjork 1994', 'Rosenshine 2012', 'Wilson et al. 2019'],
    params: { BAND_TARGET: 0.8, HARD: 4 },
    prompts: { METHOD: ['roughly four in five answers right'] },
  },
  {
    id: 'variable-retrieval',
    principle: 'Vary the retrieval cue so recall is of the idea, not the wording',
    sources: ['Butler 2010', 'Barnett & Ceci 2002'],
    prompts: { practicePrompt: ['"variants"', '"heldBack"'] },
  },
  {
    id: 'pretesting',
    principle: 'Attempt before instruction; the answer follows',
    sources: ['Richland, Kornell & Kao 2009', 'Kornell, Hays & Bjork 2009', 'Sinha & Kapur 2021'],
    prompts: { METHOD: ['Attempt first: pose a question before teaching'], warmupPrompt: ['before any teaching', '"predict"', 'At most 28 words'] },
  },
  {
    id: 'worked-examples',
    principle: 'Worked examples for novices, faded to completion problems and then independent problems',
    sources: ['Sweller & Cooper 1985', 'Renkl & Atkinson 2003', 'Kalyuga et al. 2003', 'Kirschner, Sweller & Clark 2006'],
    params: { SUPPORT_LEVELS: ['full', 'faded', 'light'] },
    prompts: { METHOD: ['Worked examples for novices, fading to independent problems'] },
  },
  {
    id: 'working-memory',
    principle: 'Few new elements at a time: three to four new terms for a novice, one idea per section',
    sources: ['Cowan 2001', 'Sweller 1988', 'Mayer & Moreno 2003'],
    params: { TERMS_COMPLETE_BEGINNER: 3, TERMS_BEGINNER: 4 },
    prompts: { lessonPrompt: ['new technical terms in this lesson', 'one idea per section'], planPrompt: ['at most 3 to 5 new terms'] },
  },
  {
    id: 'prior-knowledge',
    principle: 'Build on what is known; compare contrasting cases to bring out the principle',
    sources: ['Ausubel 1968', 'Gick & Holyoak 1983', 'Schwartz & Bransford 1998', 'Alfieri, Nokes-Malach & Schunn 2013'],
    prompts: { METHOD: ['Build on prior knowledge', 'Compare two contrasting cases'], lessonPrompt: ['"bridge"', '"compare"'] },
  },
  {
    id: 'misconceptions',
    principle: 'Name, test and replace a misconception; do not teach past it',
    sources: ['Posner et al. 1982', 'Tippett 2010', 'Schroeder & Kucera 2022'],
    prompts: { lessonPrompt: ['address it explicitly and early'], warmupPrompt: ['what people commonly believe instead'], practicePrompt: ['one practice question must test exactly that'] },
  },
  {
    id: 'threshold',
    principle: 'A few threshold concepts get more cases and more relearning',
    sources: ['Meyer & Land 2005'],
    params: { THRESHOLD_EXTRA_RELEARN: 1 },
    prompts: { planPrompt: ['at most one in five'] },
  },
  {
    id: 'feedback',
    principle: 'Feedback explains why; confident errors get the clearest correction',
    sources: ['Hattie & Timperley 2007', 'Butler, Godbole & Marsh 2013', 'Butterfield & Metcalfe 2001', 'Metcalfe 2017'],
    prompts: { METHOD: ['Feedback is specific and explains why', 'Confident mistakes deserve the clearest correction'], gradePrompt: ['WHY the correct answer is correct'] },
  },
  {
    id: 'generative',
    principle: 'Self-explanation, a why question, and teaching back on the first review day (spaced, so it is retrieval)',
    sources: ['Chi et al. 1994', 'Bisra et al. 2018', 'Fiorella & Mayer 2016', 'Kobayashi 2019'],
    prompts: { practicePrompt: ['explain the reason behind the core idea'] },
  },
  {
    id: 'transfer-use',
    principle: 'One real use of the idea the same day, named concretely so it gets done',
    sources: ['Barnett & Ceci 2002', 'Gollwitzer & Sheeran 2006'],
    prompts: { practicePrompt: ['"apply"', 'Transfer happens in use'] },
  },
  {
    id: 'interleaving',
    principle: 'Mix earlier topics into practice; a cross-topic set from four learned topics and after every three more',
    sources: ['Rohrer & Taylor 2007', 'Kornell & Bjork 2008', 'Rohrer et al. 2020', 'Brunmair & Richter 2019'],
    params: { MIXED_MIN_LEARNED: 4, MIXED_EVERY_LEARNED: 3 },
    prompts: { METHOD: ['Interleave confusable types once the basics are known'], practicePrompt: ['"mix": true'] },
  },
  {
    id: 'vocabulary-sets',
    principle: 'Group new words by theme or situation, never by semantic category',
    sources: ['Tinkham 1993', 'Waring 1997', 'Finkbeiner & Nicol 2003', 'Nakata & Suzuki 2019'],
    prompts: { METHOD: ['theme or situation', 'never by semantic category'] },
  },
  {
    id: 'mastery',
    principle: 'Progress waits on a demonstrated criterion; the tutor never hands over an unattempted answer',
    sources: ['Bloom 1984', 'Kulik, Kulik & Bangert-Drowns 1990', 'VanLehn 2011', 'Koedinger et al. 2023', 'Bastani et al. 2025'],
    params: { LEVEL_PASS: 0.8, LEVEL_DELAY: 3 * DAY, ROLE_LEVEL_GOOD: 0.7 },
  },
  {
    id: 'motor',
    principle: 'External focus, varied practice, feedback that fades, mental rehearsal',
    sources: ['Wulf 2013', 'Shea & Morgan 1979', 'Winstein & Schmidt 1990', 'Driskell, Copper & Moran 1994'],
    prompts: { METHOD: ['focus on the effect of the movement rather than the body', 'reduce feedback as the skill forms', 'mental rehearsal'] },
  },
  {
    id: 'no-learning-styles',
    principle: 'No learning styles',
    sources: ['Pashler et al. 2008'],
    prompts: { METHOD: ['Never use "learning styles"'] },
  },
  {
    id: 'curriculum',
    principle: 'Design from outcomes back; whole-task milestones; revisit core ideas at depth; the critic checks it',
    sources: ['Wiggins & McTighe 2005', 'Biggs 1996', 'van Merriënboer & Kirschner 2018', 'Bruner 1960'],
    prompts: { planPrompt: ['every outcome must be served', 'revisit the core ideas at greater depth'], reviewPlanPrompt: ['Prerequisites', 'Coverage', 'whole task', 'theme or situation'] },
  },
];

export const evidenceById = (id) => EVIDENCE.find((e) => e.id === id) || null;
