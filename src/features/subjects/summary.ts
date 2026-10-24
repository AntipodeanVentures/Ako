import { dayKey, nowMs } from '@/src/engine/core';
import { STAGES, stageIdx } from '@/src/engine/ladder';
import {
  dueCards,
  estimateStage,
  mixedDue,
  estimateText,
  fmtWeeks,
  fmtWhen,
  learnedCount,
  levelCheckReady,
  nextStageEstimate,
  nextTopic,
  paceStats,
  stagePosition,
  stageProgress,
} from '@/src/engine/progress';
import type { Topic } from '@/src/engine/types';

import type { LiveSubject } from './context';

// Plain numbers and sentences for the Learn screen, computed from the
// engine so the app and the artifact agree.

export type NextStep =
  | { kind: 'review'; count: number }
  | { kind: 'probe'; count: number }
  | { kind: 'check'; subject: LiveSubject; stageId: string; stageName: string }
  | { kind: 'mixed'; subject: LiveSubject; topics: Topic[] }
  | { kind: 'topic'; subject: LiveSubject; topic: Topic }
  | { kind: 'none' };

// What the screen knows that the subjects do not: whether this week's retention probe is ready.
export type NextStepExtras = { probe?: { due: boolean; count: number } };

export function minutesToday(subjects: LiveSubject[]): number {
  const d = dayKey(nowMs());
  return subjects.reduce((n, s) => n + (((s.stats.log as Record<string, number>) || {})[d] || 0), 0);
}

export function dueCount(subjects: LiveSubject[]): number {
  return subjects.reduce((n, s) => n + dueCards(s.cards ?? []).length, 0);
}

// The thing to do now: reviews first (they are the evidence), then a level
// check that has come due, then one new topic.
export function nextStep(subjects: LiveSubject[], extras: NextStepExtras = {}): NextStep {
  const due = dueCount(subjects);
  if (due > 0) return { kind: 'review', count: due };
  // A few questions never seen before, on topics learned about three weeks ago: the evidence that it stuck.
  if (extras.probe?.due && extras.probe.count > 0) return { kind: 'probe', count: extras.probe.count };
  for (const s of subjects) {
    const stage = levelCheckReady(s);
    if (stage) return { kind: 'check', subject: s, stageId: stage.id, stageName: stage.name };
  }
  for (const s of subjects) {
    const topics = mixedDue(s) as Topic[] | null;
    if (topics) return { kind: 'mixed', subject: s, topics };
  }
  // The subject studied least recently gets the new topic, so none goes stale.
  const ordered = [...subjects].sort((a, b) => Number(a.stats.lastStudied || 0) - Number(b.stats.lastStudied || 0));
  for (const s of ordered) {
    const t = nextTopic(s);
    if (t) return { kind: 'topic', subject: s, topic: t };
  }
  return { kind: 'none' };
}

export function todayLine(subjects: LiveSubject[], extras: NextStepExtras = {}): string {
  const due = dueCount(subjects);
  const step = nextStep(subjects, extras);
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
  if (step.kind === 'probe') parts.push(`${due ? 'then ' : ''}a five-minute check on what you learned weeks ago`);
  if (step.kind === 'check') parts.push(`${due ? 'then ' : ''}the ${step.stageName} level check in ${step.subject.plan.title}`);
  if (step.kind === 'mixed') parts.push(`${due ? 'then ' : ''}mixed practice across ${step.topics.length} earlier topics in ${step.subject.plan.title}`);
  const nt = topicStep ? topicStep.topic : step.kind === 'check' || step.kind === 'probe' || step.kind === 'mixed' ? null : firstTopic?.t;
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

// The level the learner is aiming for and when it is expected, in plain
// words: "Advanced, around mid-2028" and why.
export type AimLine = { name: string; when: string; how: string };

export function aimLine(subj: LiveSubject): AimLine | null {
  const target = String(subj.intake.target || 's3');
  const idx = stageIdx(target);
  if (idx < 0) return null;
  const name = STAGES[idx].name;
  const e = estimateStage(subj, target) as { weeks: number; at: number; checkOnly: boolean } | null;
  if (!e) return null;
  if (e.checkOnly) {
    const prog = stageProgress(subj, target);
    return { name, when: prog.ready ? 'level check ready now' : `level check in ${Math.max(1, Math.ceil((prog.eligibleAt - Date.now()) / 86400000))} days`, how: 'Every topic at this level is learned; the check waits a few days so it tests memory.' };
  }
  const when = e.weeks < 6 ? `in ${fmtWeeks(e.weeks)}` : `around ${fmtWhen(e.at)}`;
  const span = fmtWeeks(e.weeks);
  const pace = paceStats(subj) as { measured: boolean };
  const how = pace.measured
    ? `${span.charAt(0).toUpperCase() + span.slice(1)} at your pace over the last few weeks. It moves as you go.`
    : `${span.charAt(0).toUpperCase() + span.slice(1)} at the time you planned. After two weeks of study, your real pace sets it.`;
  return { name, when, how };
}

export function targetEstimate(subj: LiveSubject): string | null {
  const target = String(subj.intake.target || 's3');
  if (stageIdx(target) < 0) return null;
  return estimateText(subj, target);
}
