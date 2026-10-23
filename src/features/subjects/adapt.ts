import type { Milestone, PlanRevision, Topic } from '@/src/engine/types';
import { callJson } from '@/src/features/ai/client';

import { updateSubject } from './api';
import type { LiveSubject } from './context';

// The path adapts to the learner as evidence arrives. Two mechanisms:
//
// 1. The learner model for the subject (strengths, misconceptions,
//    comparisons that worked, a teaching note) is rewritten by the small
//    model after every topic from what happened in it, and every later
//    lesson, warm-up and tutor turn reads it.
//
// 2. The topics still ahead are revised by the frontier model at a few
//    moments: when a topic has missed the mark twice, when a level check is
//    failed, when a milestone is reached, and when the learner asks. The
//    model may insert, refocus, drop or reorder topics not yet started;
//    nothing started is touched, ids never change, and each change carries
//    a sentence to the learner, kept in plan.history and shown on the Path.

function serialisable(subj: LiveSubject) {
  const { dirtyCards: _d, ...rest } = subj;
  return rest;
}

export type Adaptation = { topics: Topic[]; milestones: Milestone[]; notes: PlanRevision['notes'] };

export async function adaptPlan(subj: LiveSubject, reason: string, opts: { note?: string; evidence?: string } = {}): Promise<Adaptation> {
  const r = await callJson<{ adaptation: Adaptation }>('plan', {
    kind: 'adapt',
    subject: serialisable(subj),
    reason,
    note: opts.note ?? '',
    evidence: opts.evidence ?? '',
  });
  const a = r.adaptation;
  if (!a?.notes?.length) return a;
  subj.plan.topics = a.topics;
  subj.plan.milestones = a.milestones;
  subj.plan.history = [...(subj.plan.history ?? []), { at: Date.now(), reason, notes: a.notes }].slice(-12);
  await updateSubject(subj.id, { plan: subj.plan });
  return a;
}

export type LearnerModel = { strengths: string[]; misconceptions: string[]; analogies: string[]; note: string; updatedAt: number };

export async function updateLearnerModel(subj: LiveSubject, topicId: string, evidence: string): Promise<LearnerModel> {
  const r = await callJson<{ model: LearnerModel }>('extract', { kind: 'model', subject: serialisable(subj), topicId, evidence });
  subj.model = r.model as unknown as Record<string, unknown>;
  await updateSubject(subj.id, { model: subj.model });
  return r.model;
}

// Runs after a topic is saved, on the server, so it finishes whether or
// not the app stays open: the learner model always; a revision of the path
// when the topic missed the mark, when a milestone was just reached, and
// otherwise every third topic mastered. The server writes the results; the
// caller refetches. Failures are logged and swallowed.
export async function afterTopic(
  subj: LiveSubject,
  topicId: string,
  evidence: string,
  ctx: { mastered: boolean; attempts: number; milestoneReached: string | null },
): Promise<PlanRevision['notes'] | null> {
  try {
    const r = await callJson<{ notes: PlanRevision['notes']; model: Record<string, unknown> | null }>('after', {
      kind: 'topic',
      subjectId: subj.id,
      topicId,
      evidence,
      mastered: ctx.mastered,
      attempts: ctx.attempts,
      milestoneReached: ctx.milestoneReached ?? '',
    });
    if (r.model) subj.model = r.model;
    return r.notes ?? [];
  } catch (e) {
    console.warn('after-topic work failed', e);
    return null;
  }
}

// Runs after a review session for one subject, on the server: cards
// forgotten today feed a revision of the path when there are two or more.
export async function afterReviews(
  subj: LiveSubject,
  forgotten: { topicTitle: string; front: string; back: string }[],
): Promise<PlanRevision['notes'] | null> {
  if (forgotten.length < 2) return null;
  try {
    const r = await callJson<{ notes: PlanRevision['notes'] }>('after', { kind: 'reviews', subjectId: subj.id, forgotten });
    return r.notes ?? [];
  } catch (e) {
    console.warn('after-reviews work failed', e);
    return null;
  }
}
