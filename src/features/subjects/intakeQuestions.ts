import { INTAKE_FALLBACK } from '@/src/engine/normalise';
import { callJson } from '@/src/features/ai/client';

// The three questions asked before a path is written: what the learner
// wants the subject for, what contact they have had with it, and where to
// aim it. The small model writes them for the subject in a second or two;
// if it is slow or fails, plain versions stand in. Fetched as soon as the
// subject is known and kept here so the screen that asks them has them
// ready.

export type IntakeSlot = 'why' | 'background' | 'focus';
export type IntakeQuestion = { slot: IntakeSlot; q: string; hint: string };

const FALLBACK = INTAKE_FALLBACK as Record<IntakeSlot, { q: string; hint: string }>;

export const fallbackQuestions: IntakeQuestion[] = (['why', 'background', 'focus'] as IntakeSlot[]).map((slot) => ({
  slot,
  q: FALLBACK[slot].q,
  hint: FALLBACK[slot].hint,
}));

const cache = new Map<string, Promise<IntakeQuestion[]>>();

export function fetchIntakeQuestions(subject: string, current: string, target: string): Promise<IntakeQuestion[]> {
  const key = subject.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const p = callJson<{ intake: { questions: IntakeQuestion[] } }>('extract', { kind: 'intake', subject, current, target })
    .then((r) => (r.intake?.questions?.length === 3 ? r.intake.questions : fallbackQuestions))
    .catch(() => {
      cache.delete(key);
      return fallbackQuestions;
    });
  cache.set(key, p);
  return p;
}

// The answers mapped onto the intake fields the prompts read.
export function answersToIntake(questions: IntakeQuestion[], answers: Record<string, string>) {
  const get = (slot: IntakeSlot) => (answers[slot] ?? '').trim();
  return {
    why: get('why'),
    background: get('background'),
    focus: get('focus'),
    answers: questions.map((q) => ({ slot: q.slot, q: q.q, a: get(q.slot) })).filter((x) => x.a),
  };
}
