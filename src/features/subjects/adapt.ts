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

// Runs after a topic is saved: the learner model always; a revision of the
// path when the topic has now missed the mark twice or a milestone was just
// reached. Failures are logged and swallowed; nothing here blocks the learner.
export async function afterTopic(
  subj: LiveSubject,
  topicId: string,
  evidence: string,
  ctx: { mastered: boolean; attempts: number; milestoneReached: string | null },
): Promise<PlanRevision['notes'] | null> {
  try {
    await updateLearnerModel(subj, topicId, evidence);
  } catch (e) {
    console.warn('learner model update failed', e);
  }
  const topic = subj.plan.topics.find((t) => t.id === topicId);
  let reason: string | null = null;
  if (!ctx.mastered && ctx.attempts >= 2) {
    reason = `The topic "${topic?.title ?? topicId}" has not reached the mark after ${ctx.attempts} attempts. Decide whether something before it is missing, whether it should be split, or whether it is fine to keep trying as it is.`;
  } else if (ctx.milestoneReached) {
    reason = `The milestone "${ctx.milestoneReached}" has just been reached. Check that the topics still ahead fit what this learner has shown and what they said they want.`;
  }
  if (!reason) return null;
  try {
    const a = await adaptPlan(subj, reason, { evidence });
    return a.notes ?? [];
  } catch (e) {
    console.warn('path revision failed', e);
    return null;
  }
}
