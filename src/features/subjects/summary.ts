import { dayKey, nowMs } from '@/src/engine/core';
import { STAGES, stageIdx } from '@/src/engine/ladder';
import {
  activityDays,
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
  retentionRate,
  secureCount,
  sittingMinutes,
  sittingMinutesLeft,
  stagePosition,
  stageProgress,
} from '@/src/engine/progress';
import { jolCalibration } from '@/src/engine/session';
import type { Topic } from '@/src/engine/types';

import type { LiveSubject } from './context';

// Subjects the learner has put away. They stay in the database (and can be
// brought back), but no screen lists them among the live ones and the
// planner no longer treats their topics as already covered.
export const isArchived = (subj: { stats: Record<string, unknown> }) => subj.stats?.archived === true;
export const liveSubjects = <T extends { stats: Record<string, unknown> }>(subjects: T[]) => subjects.filter((s) => !isArchived(s));

// The daily target: the longest slot any subject was set up with. A learner
// with two subjects at 15 and 30 minutes is aiming at 30 on a full day.
export function dailySlot(subjects: LiveSubject[]): number {
  return subjects.reduce((m, s) => Math.max(m, Number(s.intake.minutes) || 0), 0) || 15;
}

// The record of effort: a run of study days, minutes this week, the last day
// studied. Read from each subject's minutes log, so it needs no extra fetch.
export type Effort = { streak: number; weekMinutes: number; lastStudied: string | null; studiedToday: boolean };

export function effort(subjects: LiveSubject[]): Effort {
  const days = activityDays(subjects, 60) as { day: string; on: boolean }[];
  const today = days[days.length - 1];
  // A streak counts back from today, or from yesterday if today is not yet done.
  let streak = 0;
  for (let i = days.length - (today?.on ? 1 : 2); i >= 0; i--) {
    if (days[i]?.on) streak++;
    else break;
  }
  const week = days.slice(-7).map((d) => d.day);
  const weekMinutes = subjects.reduce((n, s) => {
    const log = (s.stats.log as Record<string, number>) || {};
    return n + week.reduce((m, d) => m + (log[d] || 0), 0);
  }, 0);
  const last = [...days].reverse().find((d) => d.on);
  return { streak, weekMinutes: Math.round(weekMinutes), lastStudied: last ? last.day : null, studiedToday: Boolean(today?.on) };
}

// "3 days running", "studied 4 of the last 7 days": one short line for the home screen.
export function effortLine(e: Effort): string {
  if (!e.lastStudied) return '';
  const parts: string[] = [];
  if (e.streak >= 2) parts.push(`${e.streak} days running`);
  if (e.weekMinutes > 0) parts.push(`${e.weekMinutes} min this week`);
  return parts.join(' · ');
}

// The evidence behind a subject's position, for its page: what has been
// learned, what has held up over days, how reviews are going, and how well
// the learner's own predictions match. Every number is "none yet" until it
// is earned; nothing here is estimated.
export type Evidence = {
  learned: number;
  total: number;
  secure: number;
  // Share of reviews recalled over the last four weeks, once there are ten.
  recall: number | null;
  // How far the learner's own predictions ran from the outcome (positive = over-confident), once there are three.
  calibration: number | null;
  calibrationN: number;
};

export function subjectEvidence(subj: LiveSubject): Evidence {
  const cal = jolCalibration(subj) as { n: number; bias: number | null };
  return {
    learned: learnedCount(subj),
    total: subj.plan.topics.length,
    secure: secureCount(subj),
    recall: retentionRate(subj) as number | null,
    calibration: cal.n >= 3 ? cal.bias : null,
    calibrationN: cal.n,
  };
}

// The reasons a revision was made are written for the model; the learner
// sees a plain label instead.
export function revisionLabel(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('asked')) return 'You asked for a change';
  if (r.includes('milestone')) return 'After a milestone';
  if (r.includes('missed the mark') || r.includes('not reached the mark')) return 'After a topic missed the mark';
  if (r.includes('level check')) return 'After a level check';
  if (r.includes('forgot')) return 'After forgotten reviews';
  if (r.includes('routine')) return 'A routine look at the path';
  return 'The path was revised';
}

// Plain numbers and sentences for the Learn screen, computed from the
// engine so the app and the artifact agree.

export type NextStep =
  | { kind: 'resume'; subject: LiveSubject; topic: Topic; step: string }
  | { kind: 'review'; count: number }
  | { kind: 'probe'; count: number }
  | { kind: 'check'; subject: LiveSubject; stageId: string; stageName: string }
  | { kind: 'mixed'; subject: LiveSubject; topics: Topic[] }
  | { kind: 'topic'; subject: LiveSubject; topic: Topic }
  | { kind: 'none' };

// What the screen knows that the subjects do not: whether this week's retention probe is ready,
// and a sitting left unfinished on this device.
export type NextStepExtras = {
  probe?: { due: boolean; count: number };
  resume?: { subjectId: string; topicId: string; title: string; step: string } | null;
};

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
  // A sitting left halfway is finished first: the lesson is read, the evidence is not yet in.
  if (extras.resume) {
    const subject = subjects.find((s) => s.id === extras.resume?.subjectId);
    const topic = subject?.plan.topics.find((t) => t.id === extras.resume?.topicId);
    if (subject && topic) return { kind: 'resume', subject, topic, step: extras.resume.step };
  }
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

// A typed review takes about half a minute; a run is capped (see review.tsx).
export const REVIEW_CAP = 20;
export const REVIEW_MINUTES_EACH = 0.5;

// How long the next step is likely to take, in whole minutes, so the Start button is an honest promise.
export function minutesFor(step: NextStep): number | null {
  switch (step.kind) {
    case 'resume': return sittingMinutesLeft(step.subject, step.topic, step.step) as number;
    case 'review': return Math.max(1, Math.round(Math.min(step.count, REVIEW_CAP) * REVIEW_MINUTES_EACH));
    case 'probe': return 5;
    case 'check': return 8;
    case 'mixed': return 10;
    case 'topic': return sittingMinutes(step.subject, step.topic) as number;
    default: return null;
  }
}

export const aboutMinutes = (m: number | null) => (m == null ? '' : m <= 1 ? 'about a minute' : `about ${m} min`);

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
  if (step.kind === 'resume') {
    const where: Record<string, string> = { warm: 'at the warm-up', learn: 'partway through the lesson', drill: 'at the drill', recall: 'at the recall step', practice: 'partway through practice', teach: 'at the teach-back', roleplay: 'in the role-play' };
    parts.push(`you stopped ${where[step.step] ?? 'partway through'} ${step.topic.title.toLowerCase()}; pick it up where you left off`);
  }
  if (due) parts.push(`${due} ${due === 1 ? 'review' : 'reviews'}${subjects.length > 1 ? ' across your subjects' : ''}`);
  if (step.kind === 'probe') parts.push(`${due ? 'then ' : ''}a five-minute check on what you learned weeks ago`);
  if (step.kind === 'check') parts.push(`${due ? 'then ' : ''}the ${step.stageName} level check in ${step.subject.plan.title}`);
  if (step.kind === 'mixed') parts.push(`${due ? 'then ' : ''}mixed practice across ${step.topics.length} earlier topics in ${step.subject.plan.title}`);
  const nt = topicStep ? topicStep.topic : step.kind === 'check' || step.kind === 'probe' || step.kind === 'mixed' || step.kind === 'resume' ? null : firstTopic?.t;
  const ns = topicStep ? topicStep.subject : firstTopic?.s;
  if (nt) {
    // A topic that comes back: it missed the mark last time, or a level check reopened it.
    const st = (ns?.topicState[nt.id] ?? {}) as { status?: string; attempts?: number; reopenedAt?: number };
    const again = st.status === 'learning' && (Number(st.attempts) > 0 || Boolean(st.reopenedAt));
    parts.push(`${due ? 'then ' : ''}${again ? (st.reopenedAt ? 'back to' : 'another go, simpler, at') : 'one new idea:'} ${nt.title.toLowerCase()}`);
  }
  if (!parts.length) return subjects.length ? 'Nothing due right now. Reviews come back as they fall due; open a subject to go further today.' : 'Add a subject to begin.';
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
  // Plain words for where they stand. The share is of the level's topics learned.
  const position = pos.done
    ? 'Expert reached'
    : pos.explicit >= 0
      ? `${STAGES[pos.explicit].name} reached · ${cur.name} ${pct}% learned`
      : prog.inPlan
        ? pct > 0 ? `${cur.name} · ${pct}% learned` : `${cur.name} · not started`
        : `${cur.name} · topics not written yet`;
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
