// Row types for the Ako schema. Written by hand to match
// supabase/migrations/*.sql; regenerate with
//   supabase gen types typescript --local > src/types/database.ts
// once a project exists, and keep the engine types in src/engine/types.ts
// as the source of truth for the JSON payloads.

import type { Plan, RoleMap, TopicStatus } from '@/src/engine/types';

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
  created_at: string;
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
