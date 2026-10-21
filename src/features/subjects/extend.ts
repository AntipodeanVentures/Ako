import { STAGES, stageIdx } from '@/src/engine/ladder';
import type { Milestone, StageId, Topic } from '@/src/engine/types';
import { callJson } from '@/src/features/ai/client';

import { updateSubject } from './api';
import type { LiveSubject } from './context';

// The first plan covers the starting level and the one above. When a level
// is reached, the next one up gets its topics written, as far as the
// learner's target. Returns the stage that was added, or null if the plan
// already covers the next level (or the target is met).
export function nextStageToPlan(subj: LiveSubject): StageId | null {
  const target = stageIdx(String(subj.intake.target || 's3'));
  const planned = new Set(subj.plan.topics.map((t) => t.stage));
  for (let i = 0; i < STAGES.length; i++) {
    const id = STAGES[i].id as StageId;
    if (planned.has(id)) continue;
    // Stages below the first planned one are the learner's starting point, not gaps.
    const firstPlanned = Math.min(...subj.plan.topics.map((t) => stageIdx(t.stage)));
    if (i < firstPlanned) continue;
    if (i > target) return null;
    return id;
  }
  return null;
}

function serialisable(subj: LiveSubject) {
  const { dirtyCards: _d, ...rest } = subj;
  return rest;
}

export async function extendPlanTo(subj: LiveSubject, stageId: StageId): Promise<{ topics: Topic[]; milestones: Milestone[] }> {
  const r = await callJson<{ extension: { topics: Topic[]; milestones: Milestone[] } }>('plan', {
    kind: 'extend',
    subject: serialisable(subj),
    stageId,
  });
  const ext = r.extension;
  subj.plan.milestones.push(...ext.milestones);
  subj.plan.topics.push(...ext.topics);
  await updateSubject(subj.id, { plan: subj.plan });
  return ext;
}
