import { dayKey, nowMs } from '@/src/engine/core';
import { STAGES, stageIdx } from '@/src/engine/ladder';
import {
  dueCards,
  estimateText,
  learnedCount,
  levelCheckReady,
  nextStageEstimate,
  nextTopic,
  stagePosition,
  stageProgress,
} from '@/src/engine/progress';
import type { Topic } from '@/src/engine/types';

import type { LiveSubject } from './context';

// Plain numbers and sentences for the Learn screen, computed from the
// engine so the app and the artifact agree.

export type NextStep =
  | { kind: 'review'; count: number }
  | { kind: 'check'; subject: LiveSubject; stageId: string; stageName: string }
  | { kind: 'topic'; subject: LiveSubject; topic: Topic }
  | { kind: 'none' };

export function minutesToday(subjects: LiveSubject[]): number {
  const d = dayKey(nowMs());
  return subjects.reduce((n, s) => n + (((s.stats.log as Record<string, number>) || {})[d] || 0), 0);
}

export function dueCount(subjects: LiveSubject[]): number {
  return subjects.reduce((n, s) => n + dueCards(s.cards ?? []).length, 0);
}

// The thing to do now: reviews first (they are the evidence), then a level
// check that has come due, then one new topic.
export function nextStep(subjects: LiveSubject[]): NextStep {
  const due = dueCount(subjects);
  if (due > 0) return { kind: 'review', count: due };
  for (const s of subjects) {
    const stage = levelCheckReady(s);
    if (stage) return { kind: 'check', subject: s, stageId: stage.id, stageName: stage.name };
  }
  // The subject studied least recently gets the new topic, so none goes stale.
  const ordered = [...subjects].sort((a, b) => Number(a.stats.lastStudied || 0) - Number(b.stats.lastStudied || 0));
  for (const s of ordered) {
    const t = nextTopic(s);
    if (t) return { kind: 'topic', subject: s, topic: t };
  }
  return { kind: 'none' };
}

export function todayLine(subjects: LiveSubject[]): string {
  const due = dueCount(subjects);
  const step = nextStep(subjects);
  const topicStep = step.kind === 'topic' ? step : null;
  const firstTopic = (() => {
    for (const s of subjects) {
      const t = nextTopic(s);
      if (t) return { s, t };
    }
    return null;
  })();
  const parts: string[] = [];
  if (due) parts.push(`${due} ${due === 1 ? 'review' : 'reviews'}${subjects.length > 1 ? ' across your subjects' : ''}`);
  if (step.kind === 'check') parts.push(`${due ? 'then ' : ''}the ${step.stageName} level check in ${step.subject.plan.title}`);
  const nt = topicStep ? topicStep.topic : step.kind === 'check' ? null : firstTopic?.t;
  const ns = topicStep ? topicStep.subject : firstTopic?.s;
  if (nt) {
    // A topic that comes back: it missed the mark last time, or a level check reopened it.
    const st = (ns?.topicState[nt.id] ?? {}) as { status?: string; attempts?: number; reopenedAt?: number };
    const again = st.status === 'learning' && (Number(st.attempts) > 0 || Boolean(st.reopenedAt));
    parts.push(`${due ? 'then ' : ''}${again ? (st.reopenedAt ? 'back to' : 'another go, simpler, at') : 'one new idea:'} ${nt.title.toLowerCase()}`);
  }
  if (!parts.length) return 'Nothing due. Add a subject to keep going.';
  const line = parts.join(', ');
  // A topic title may end in its own question mark; do not add a full stop after it.
  return line.charAt(0).toUpperCase() + line.slice(1) + (/[.!?]$/.test(line) ? '' : '.');
}

export type SubjectLine = {
  title: string;
  reached: number;
  current: number;
  progress: number;
  // "Capable, 60% evidenced"
  position: string;
  // "about CEFR B1"
  marker: string;
  // "Proficient expected in about 6 weeks", "Capable level check ready now"
  estimate: string;
  learned: number;
  total: number;
};

export function subjectLine(subj: LiveSubject): SubjectLine {
  const pos = stagePosition(subj);
  const cur = STAGES[pos.currentIdx];
  const prog = stageProgress(subj, cur.id);
  const def = subj.plan.stages.find((s) => s.id === cur.id);
  const pct = Math.round(prog.pct * 100);
  const position = pos.done
    ? 'Expert reached'
    : pos.explicit >= 0
      ? `${STAGES[pos.explicit].name} reached, ${cur.name} ${pct}%`
      : prog.inPlan
        ? `${cur.name}, ${pct}% evidenced`
        : `${cur.name} not planned yet`;
  const est = nextStageEstimate(subj);
  const estimate = est ? `${est.name} ${est.text.startsWith('level') ? est.text : 'expected in ' + est.text.replace(/ \(.*\)$/, '')}` : '';
  return {
    title: subj.plan.title || String(subj.intake.subject || ''),
    reached: pos.reached,
    current: pos.currentIdx,
    progress: prog.pct,
    position,
    marker: def?.equivalent ? `about ${def.equivalent}` : '',
    estimate,
    learned: learnedCount(subj),
    total: subj.plan.topics.length,
  };
}

export function targetEstimate(subj: LiveSubject): string | null {
  const target = String(subj.intake.target || 's3');
  if (stageIdx(target) < 0) return null;
  return estimateText(subj, target);
}
