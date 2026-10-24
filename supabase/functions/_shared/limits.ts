// Free-tier and Pro ceilings. One place to change when the pricing decision lands.
// Reviews are local and unlimited; these cover the calls that cost money.

export type Tier = 'free' | 'pro';

// During the private beta (BETA_UNLIMITED unset or "true") every account gets the Pro ceilings, which exist
// only so a runaway loop cannot run up the bill. Set BETA_UNLIMITED=false as a function secret to turn the
// free tier on when pricing lands.
export const BETA_UNLIMITED = (Deno.env.get('BETA_UNLIMITED') ?? 'true') !== 'false';

export const LIMITS: Record<Tier, { lessonsPerWeek: number; gradesPerDay: number; tutorTurnsPerDay: number; plansPerWeek: number }> = {
  free: { lessonsPerWeek: 3, gradesPerDay: 40, tutorTurnsPerDay: 30, plansPerWeek: 2 },
  // Pro has a soft daily cap so a runaway loop cannot run up the bill; the app shows a friendly message.
  pro: { lessonsPerWeek: 60, gradesPerDay: 400, tutorTurnsPerDay: 300, plansPerWeek: 20 },
};

// The three tiers. Names are configuration, not code: change here when a better or cheaper model arrives.
export const MODELS = {
  frontier: Deno.env.get('MODEL_FRONTIER') ?? 'claude-opus-5-5',
  mid: Deno.env.get('MODEL_MID') ?? 'claude-sonnet-5-5',
  small: Deno.env.get('MODEL_SMALL') ?? 'claude-haiku-5-5',
};

// Which model does which job. The rule: the frontier model wherever the
// output shapes weeks of study or decides what counts as mastery, and is
// not on the learner's critical path; the mid model for what the learner
// is waiting on and for marking, where it is both fast and good; the small
// model only for bounded, low-stakes extraction. Any task can be moved
// with a function secret MODEL_<TASK> (for example MODEL_LESSON=claude-opus-5-5).
export type Task =
  | 'plan' | 'review' | 'extend' | 'adapt' | 'role' | 'check' | 'placement' | 'lessonDeep' // the course and its checks
  | 'lesson' | 'warm' | 'practice' | 'bridge' | 'more' | 'tutor' | 'debrief' | 'photo' // teaching, on the critical path
  | 'grade' | 'model' | 'intake' | 'know' // marking and the learner record
  | 'start'; // bounded extraction
const TASK_TIER: Record<Task, keyof typeof MODELS> = {
  plan: 'frontier', // the course design: weeks of study depend on it
  review: 'frontier', // the critic pass on the course
  extend: 'frontier', // the next level's topics
  adapt: 'frontier', // revising the path from evidence
  role: 'frontier', // mapping a job into subjects
  check: 'frontier', // the level check: it decides whether a level counts as reached
  placement: 'frontier', // the placement check: it decides what the learner skips
  lessonDeep: 'frontier', // lessons that matter most: threshold concepts, and topics coming back after a miss
  lesson: 'mid', // every other lesson: the learner is waiting, and the mid model writes well
  warm: 'mid', // the warm-up questions, first thing the learner waits for
  practice: 'mid', // the recall and practice set, written from the lesson text while the learner reads
  bridge: 'small', // two sentences answering the warm-up, written while the learner opens the lesson
  more: 'mid', // more practice items
  tutor: 'mid', // the teach-back student and the role-play partner, turn by turn
  debrief: 'mid', // marking a role-play against its criteria
  photo: 'mid', // form check from a photo
  grade: 'mid', // marking short answers with feedback that explains why: the moment learning happens
  model: 'mid', // rewriting the learner model after a topic: what every later lesson reads
  intake: 'mid', // choosing the questions to ask before the path
  know: 'mid', // reading a CV into what the learner knows
  start: 'small', // suggesting a starting level from the profile
};
export function modelFor(task: Task): string {
  return Deno.env.get('MODEL_' + task.replace(/([A-Z])/g, '_$1').toUpperCase()) ?? MODELS[TASK_TIER[task]];
}
