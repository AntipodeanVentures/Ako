// Row types for the Ako schema. Written by hand to match
// supabase/migrations/*.sql; regenerate with
//   supabase gen types typescript --local > src/types/database.ts
// once a project exists, and keep the engine types in src/engine/types.ts
// as the source of truth for the JSON payloads.

import type { Plan, RoleMap, StageId, TopicStatus } from '@/src/engine/types';

export type Profile = {
  id: string;
  display_name: string;
  about: string;
  voice_on: boolean;
  reminder_time: string | null; // "07:10"
  study_plan: { time: string; place: string } | null;
  retention: number; // FSRS request retention, 0.8 to 0.97
  new_per_session: number;
  review_cap: number;
  model: Record<string, unknown> | null; // learner model across subjects
  created_at: string;
};

export type KnowItemRow = {
  id: string;
  profile_id: string;
  kind: string;
  title: string;
  detail: string;
  source: 'typed' | 'cv' | 'photo' | 'linkedin';
  confirmed_at: string;
  created_at: string;
};

// A field the learner brought with them: a claim with its evidence, and the level a check from
// memory showed once they have taken one. See supabase/migrations/0013_prior_fields.sql.
export type PriorFieldRow = {
  id: string;
  profile_id: string;
  // The body of knowledge the discipline belongs to (Martial arts for Judo); '' until placed.
  domain: string;
  // The discipline (kept as "field" throughout the app) and the area within it.
  field: string;
  area: string;
  level: StageId;
  basis: string;
  source: 'typed' | 'cv' | 'photo' | 'linkedin';
  verified_level: StageId | null;
  verified_at: string | null;
  verified: { score: number; asked: number; byLevel: Record<string, { ok: number; n: number }> } | null;
  evidence: { ok: number; n: number };
  created_at: string;
  updated_at: string;
};

// A record of knowledge the learner issued under a code. The snapshot is the record's content
// at the moment it was issued (src/features/record/build.ts). See supabase/migrations/0014_records.sql.
export type RecordRow = {
  code: string;
  profile_id: string;
  name: string;
  snapshot: Record<string, unknown>;
  issued_at: string;
  revoked_at: string | null;
};

export type SubjectRow = {
  id: string;
  profile_id: string;
  title: string;
  intake: Record<string, unknown>;
  plan: Plan;
  plan_version: number;
  pitch: number | null;
  support: 'full' | 'faded' | 'light';
  stats: Record<string, unknown>;
  model: Record<string, unknown> | null;
  role_area_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TopicStateRow = {
  subject_id: string;
  profile_id: string;
  topic_id: string;
  status: Exclude<TopicStatus, 'locked' | 'available'>;
  correct: number;
  misses: number;
  relearn_days: string[];
  jol: number | null;
  jol_actual: number | null;
  mastered_at: string | null;
  extra: Record<string, unknown>;
  updated_at: string;
};

export type StageStateRow = {
  subject_id: string;
  profile_id: string;
  stage_id: string;
  reached_at: string | null;
  score: number | null;
  total: number | null;
  placed: boolean;
  checked_at: string | null;
};

export type ActivityRow = {
  subject_id: string;
  profile_id: string;
  day: string; // YYYY-MM-DD
  lesson_minutes: number;
  review_minutes: number;
};

export type CardRow = {
  id: string;
  profile_id: string;
  subject_id: string;
  topic_id: string;
  front: string;
  back: string;
  concept: number | null;
  concept_name: string | null;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  learned_day: string | null;
  relearn_days: string[];
  first_review: { at: number; ok: boolean } | null;
  reviews: number;
  fronts: string[];
  suspended: boolean;
  created_at: string;
};

// A question held back from a lesson for the retention probe weeks later.
export type ProbeItemRow = {
  id: string;
  profile_id: string;
  subject_id: string;
  topic_id: string;
  item: Record<string, unknown>;
  taught: Record<string, unknown> | null;
  created_at: string;
  asked_at: string | null;
  score: number | null;
  response: string | null;
};

export type ReviewLogRow = {
  id: string;
  card_id: string;
  profile_id: string;
  subject_id: string;
  rating: number;
  elapsed_days: number;
  scheduled_days: number;
  reviewed_at: string;
};

export type RoleRow = {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  map: RoleMap;
  created_at: string;
};

export type RoleAreaRow = {
  id: string;
  role_id: string;
  profile_id: string;
  area_id: string;
  title: string;
  kind: 'knowledge' | 'skill' | 'interpersonal';
  level_needed: string;
  have: boolean;
  have_why: string;
  subject_id: string | null;
  evidence: { text: string; done: boolean; why: string }[];
};

export type UsageRow = {
  profile_id: string;
  day: string;
  kind: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
};
