// Shapes of the engine's JSON payloads, as stored in the database and passed to the prompts.
// Kept loose on purpose: the validators in normalise.js are the real contract, and these types
// describe what they produce.

export type StageId = 's1' | 's2' | 's3' | 's4' | 's5';
export type TopicKind = 'concept' | 'procedure' | 'vocabulary' | 'motor' | 'strategy' | 'roleplay';
export type TopicStatus = 'locked' | 'available' | 'learning' | 'practising' | 'mastered' | 'known';

export type PlanStage = {
  id: StageId;
  means: string;
  basis: string;
  equivalent: string;
  outcomes: string[];
  external: string;
  hours: number;
};

export type Topic = {
  id: string;
  title: string;
  summary: string;
  kind: TopicKind;
  stage: StageId;
  outcome: number | null;
  threshold: boolean;
  milestone: string;
  prereqs: string[];
  minutes: number;
};

export type Milestone = { id: string; title: string; test: string; stage: StageId };

export type Plan = {
  v: number;
  title: string;
  subjectType: 'knowledge' | 'language' | 'physical' | 'mixed' | 'interpersonal';
  language: string | null;
  summary: string;
  stages: PlanStage[];
  rules: string[];
  milestones: Milestone[];
  topics: Topic[];
  resources: { title: string; creator: string; type: string; why: string; search: string }[];
  safety: string[];
  changes?: string[];
  // Revisions made from evidence after the plan was written (newest last).
  history?: PlanRevision[];
};

export type PlanRevision = {
  at: number;
  reason: string;
  notes: { op: 'insert' | 'replace' | 'remove' | 'move'; id: string; title: string; why: string }[];
};

export type PracticeItem = {
  type: 'mcq' | 'short';
  kind: 'question' | 'decision';
  prompt: string;
  options?: string[];
  answer: number | string;
  explanation: string;
  difficulty: number;
  concept: number | null;
  mix?: boolean;
  topicId?: string;
};

// What normaliseLesson produces (src/engine/normalise.js is the contract).
export type Lesson = {
  v: number;
  stage?: string;
  createdAt?: number;
  concepts: string[];
  bridge: string;
  compare: { a: string; b: string; question: string; answer: string } | null;
  sections: { heading: string; paragraphs: string[]; points: string[] }[];
  workedExample: { problem: string; steps: string[]; gaps: number[]; answer: string } | null;
  mistakes: string[];
  recall: string;
  recallAnswer: string;
  why: string;
  whyAnswer: string;
  practice: PracticeItem[];
  cards: { front: string; back: string; concept: number | null }[];
  drill: { steps: string[]; dose: string; checks: string[]; cues: string[]; feedback: string; imagery: string; safety: string } | null;
  scenario: { setting: string; yourRole: string; claudeRole: string; goal: string; criteria: string[]; opener: string } | null;
  resources: { title: string; creator: string; search: string }[];
};

export type Card = {
  id: string;
  topicId: string;
  front: string;
  back: string;
  concept: number | null;
  conceptName?: string;
  createdAt: number;
  due: number;
  srs: {
    due: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    learning_steps: number;
    reps: number;
    lapses: number;
    state: number;
    last_review: number | null;
  };
  reviews: number;
  learnedDay?: string;
  relearnDays?: string[];
  firstReview?: { at: number; ok: boolean } | null;
};

export type RoleArea = {
  id: string;
  title: string;
  kind: 'knowledge' | 'skill' | 'interpersonal';
  level: StageId;
  why: string;
  have: boolean;
  haveWhy: string;
  subjectId?: string | null;
};

export type RoleMap = {
  summary: string;
  areas: RoleArea[];
  evidence: { text: string; done: boolean; why: string }[];
  firstSteps: string;
};

// The subject record as the engine sees it: the stored row plus the learner's context attached by the caller.
export type SubjectContext = {
  id: string;
  intake: Record<string, unknown>;
  plan: Plan;
  topicState: Record<string, Record<string, unknown>>;
  stages: Record<string, unknown>;
  milestones: Record<string, unknown>;
  stats: Record<string, unknown>;
  pitch?: number | null;
  support?: 'full' | 'faded' | 'light';
  model?: Record<string, unknown> | null;
  cards?: Card[];
  learner?: { about?: string; model?: Record<string, unknown> | null };
};
