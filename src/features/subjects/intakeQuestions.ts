import { INTAKE_FALLBACK } from '@/src/engine/normalise';
import { callJson } from '@/src/features/ai/client';

// The questions asked before a path is written: at most three, chosen by
// the model as the ones whose answers would most change the course for
// this subject and this learner (what it is for, which strand, what they
// are following, what shapes their practice). Each comes with quick
// answers to tap and room to type. Fetched as soon as the subject is known
// and kept here so the screen that asks them has them ready; if the model
// is slow or fails, two plain questions stand in.

export type IntakeSlot = 'why' | 'focus' | 'background' | 'constraint' | 'material' | 'other';
export type IntakeQuestion = { slot: IntakeSlot; q: string; options: string[]; multi: boolean; effect: string };
// What the learner picked and typed for one question.
export type IntakeAnswer = { picked: string[]; other: string };

export const fallbackQuestions: IntakeQuestion[] = (INTAKE_FALLBACK as IntakeQuestion[]).map((q) => ({ ...q, options: [...q.options] }));

const cache = new Map<string, Promise<IntakeQuestion[]>>();

export function fetchIntakeQuestions(subject: string, current: string, target: string, minutes: number): Promise<IntakeQuestion[]> {
  const key = `${subject.trim().toLowerCase()}|${current}|${target}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = callJson<{ intake: { questions: IntakeQuestion[] } }>('extract', { kind: 'intake', subject, current, target, minutes })
    .then((r) => (r.intake?.questions?.length ? r.intake.questions : fallbackQuestions))
    .catch(() => {
      cache.delete(key);
      return fallbackQuestions;
    });
  cache.set(key, p);
  return p;
}

// The chip that opens the box to type in; never part of the answer itself.
export const OTHER = 'Something else';

// One question's answer as a line of text: the picks, then anything typed.
export function answerText(a: IntakeAnswer | undefined): string {
  if (!a) return '';
  const parts = [...a.picked.filter((x) => x !== OTHER), a.other.trim()].filter(Boolean);
  return parts.join('; ');
}

// The answers mapped onto the intake fields the prompts read: why, focus
// and background from their slots, and every answered question verbatim.
export function answersToIntake(questions: IntakeQuestion[], answers: Record<number, IntakeAnswer>) {
  const bySlot = (slot: IntakeSlot) =>
    questions
      .map((q, i) => (q.slot === slot ? answerText(answers[i]) : ''))
      .filter(Boolean)
      .join('; ');
  return {
    why: bySlot('why'),
    background: bySlot('background'),
    focus: bySlot('focus'),
    answers: questions.map((q, i) => ({ slot: q.slot, q: q.q, a: answerText(answers[i]), effect: q.effect })).filter((x) => x.a),
  };
}
