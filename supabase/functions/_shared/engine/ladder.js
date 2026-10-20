// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

import { DAY, clampNum, num } from './core.js';

const STAGES = [
  { id: 's1', name: 'Beginner', short: 'Begin.', fheq: 'usual anchors: FHEQ level 4, CEFR A1 to A2, a first belt or grade', blurb: 'I can follow: you know the basic parts and can do simple things with a model to copy.' },
  { id: 's2', name: 'Capable', short: 'Capable', fheq: 'usual anchors: FHEQ level 5, CEFR B1, an intermediate belt or grade', blurb: 'I can do it: you handle routine tasks on your own in familiar situations.' },
  { id: 's3', name: 'Proficient', short: 'Profic.', fheq: "usual anchors: FHEQ level 6 (Bachelor's), CEFR B2, an advanced belt or grade", blurb: 'I can adapt: you handle unfamiliar situations and know why things work.' },
  { id: 's4', name: 'Advanced', short: 'Adv.', fheq: "usual anchors: FHEQ level 7 (Master's), CEFR C1, instructor or senior grade", blurb: 'I can teach it: fluent and fast, with sound judgement under pressure, able to coach others.' },
  { id: 's5', name: 'Expert', short: 'Expert', fheq: 'usual anchors: FHEQ level 8 (Doctorate), CEFR C2, examiner, titled or professional standing', blurb: 'I can extend it: you set standards and create work others learn from.' }
];
const stageIdx = (id) => Math.max(0, STAGES.findIndex((s) => s.id === id));
const stageName = (id) => (STAGES[stageIdx(id)] || STAGES[0]).name;
const START_STAGE = { 'Complete beginner': 0, 'Know a little': 0, 'Intermediate': 1, 'Used to be good, now rusty': 1 };

// How lessons are pitched. Set from the starting level, then moved by "too hard" and "too easy" ratings.
const PITCH = [null,
  { label: 'Complete beginner', text: 'complete beginner. Assume no knowledge of this field at all. Use everyday words, everyday examples and short sentences.', terms: 3, words: '200 to 400' },
  { label: 'Beginner', text: 'beginner who knows a little. Explain every technical term in plain words when it first appears, and build up step by step.', terms: 4, words: '250 to 450' },
  { label: 'Intermediate', text: 'intermediate. They know the basic ideas and common terms of the field. Explain new terms briefly and go a level deeper.', terms: 6, words: '300 to 550' },
  { label: 'Advanced', text: 'advanced. They are comfortable with the field. Be precise and concise, and focus on mechanisms, evidence and nuance.', terms: 8, words: '350 to 600' },
  { label: 'Expert', text: 'expert. Go into technical depth, edge cases and current debates.', terms: 12, words: '400 to 650' }];
const START_PITCH = { 'Complete beginner': 1, 'Know a little': 2, 'Intermediate': 3, 'Used to be good, now rusty': 3 };
const pitchOf = (subj) => clampNum(Math.round(num(subj && subj.pitch, START_PITCH[subj && subj.intake && subj.intake.current] || 2)), 1, 5);
// How much support a lesson gives. Worked examples fade as practice goes well (the expertise reversal effect).
const SUPPORT = {
  full: { label: 'Full worked examples', next: 'faded', prev: 'full', text: 'Give a complete worked example with every step shown and the reason for each step. Practice begins with questions close to the example.' },
  faded: { label: 'Partly worked examples', next: 'light', prev: 'full', text: 'Give a worked example with the first steps shown and the final one or two steps left for the learner to complete (a completion problem), with the completed steps given afterwards. Practice moves quickly to independent problems.' },
  light: { label: 'Independent problems', next: 'light', prev: 'faded', text: 'Give only a brief example, then let the learner work independently. Practice is mostly application and transfer to new situations.' }
};
const supportOf = (subj) => (SUPPORT[subj && subj.support] ? subj.support : 'full');
const PLAN_VERSION = 4;
const RELEARN_TARGET = 3;      // successful reviews on separate days before a topic counts as secure (successive relearning)
const relearnTarget = (t) => (t && t.threshold ? RELEARN_TARGET + 1 : RELEARN_TARGET);   // threshold concepts get one more
const ROLE_LEVEL_GOOD = 0.7;   // role-play debrief score that counts as passing
const CRITERION = 3;           // correct practice answers before a topic counts as learned
const BAND_TARGET = 0.8;       // aim for roughly four in five practice answers right
const LEVEL_PASS = 0.8;        // share of a level check that must be right
const LEVEL_DELAY = 3 * DAY;   // the level check waits until the last topic is at least this old, so it tests memory
const START_LEVELS = ['Complete beginner', 'Know a little', 'Intermediate', 'Used to be good, now rusty'];

export { STAGES, stageIdx, stageName, START_STAGE, PITCH, START_PITCH, pitchOf, SUPPORT, supportOf, PLAN_VERSION, RELEARN_TARGET, relearnTarget, ROLE_LEVEL_GOOD, CRITERION, BAND_TARGET, LEVEL_PASS, LEVEL_DELAY, START_LEVELS };
