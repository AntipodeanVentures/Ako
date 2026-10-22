import { useSyncExternalStore } from 'react';

import { coverTarget } from '@/src/engine/ladder';
import type { Plan, StageId } from '@/src/engine/types';
import { aiErrorCopy, callJson, callStream } from '@/src/features/ai/client';
import { queryClient } from '@/src/lib/queryClient';

import { createSubject, updateSubject } from './api';

// Builds a plan for a new subject and keeps going while the learner moves
// on. The `plan` function streams the draft; a second call runs the critic
// pass (two calls, so neither runs near the server's time limit). The draft
// is good enough to start on, so the subject is saved as soon as the draft
// lands and the reviewed plan replaces it when the critic finishes.
// Module state rather than React state so navigating away does not cancel
// the stream.

export type Intake = {
  subject: string;
  target: StageId;
  current: string; // one of START_LEVELS
  hours: number; // a week
  minutes: number; // the daily slot they chose
  background: string;
  why: string;
  // Where they most want to aim the subject, in their words.
  focus?: string;
  // The intake questions and their answers, verbatim, for the plan prompt.
  answers?: { slot: string; q: string; a: string }[];
  syllabus?: string;
  role?: string;
};

export type BuildStatus = 'idle' | 'building' | 'draft' | 'saving' | 'ready' | 'error';

export type BuildState = {
  status: BuildStatus;
  intake: Intake | null;
  // Live progress parsed from the stream while the draft is being written.
  progress: { chars: number; stages: number; topics: number };
  draft: Plan | null;
  plan: Plan | null;
  subjectId: string | null;
  error: string | null;
  startedAt: number | null;
};

const initial: BuildState = {
  status: 'idle',
  intake: null,
  progress: { chars: 0, stages: 0, topics: 0 },
  draft: null,
  plan: null,
  subjectId: null,
  error: null,
  startedAt: null,
};

let state: BuildState = initial;
const listeners = new Set<() => void>();
let run = 0;

function set(patch: Partial<BuildState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getBuildState() {
  return state;
}

export function usePlanBuild(): BuildState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getBuildState,
    getBuildState,
  );
}

export function resetBuild() {
  run++;
  state = initial;
  listeners.forEach((l) => l());
}

// Counts how much of the plan has arrived from the raw JSON as it streams:
// each stage object carries an "id":"sN", each topic a "kind".
function parseProgress(text: string) {
  const stages = (text.match(/"id"\s*:\s*"s[1-5]"/g) || []).length;
  const topicsStart = text.indexOf('"topics"');
  const topics = topicsStart >= 0 ? (text.slice(topicsStart).match(/"kind"\s*:/g) || []).length : 0;
  return { chars: text.length, stages: Math.min(5, stages), topics };
}

async function persist(profileId: string, intake: Intake, plan: Plan, existingId: string | null) {
  if (existingId) {
    await updateSubject(existingId, { plan, plan_version: plan.v });
    return existingId;
  }
  const row = await createSubject(profileId, {
    title: plan.title || intake.subject,
    intake,
    plan,
    plan_version: plan.v,
    pitch: null,
  });
  return row.id;
}

// Starts a build. Safe to call again with a new intake: the previous run is
// abandoned (its events are ignored) and a fresh one begins.
export async function startBuild(profileId: string, intake: Intake) {
  const my = ++run;
  set({ ...initial, status: 'building', intake, startedAt: Date.now() });
  const coverTo = coverTarget(intake);
  let subjectId: string | null = null;
  try {
    const result = await callStream<{ plan: Plan }>(
      'plan',
      { intake, coverTo },
      {
        onText: (text) => {
          if (my !== run) return;
          set({ progress: parseProgress(text) });
        },
      },
    );
    if (my !== run) return;
    const draft = result.plan;
    set({ draft, status: 'draft' });
    // Save straight away so the learner can start while the critic runs.
    subjectId = await persist(profileId, intake, draft, null);
    if (my !== run) return;
    set({ subjectId });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });

    // The critic pass: a second call that reads the draft against the
    // learner and the level definitions and returns a corrected plan.
    const reviewed = await callJson<{ plan: Plan }>('plan', { kind: 'review', intake, coverTo, plan: draft });
    if (my !== run) return;
    set({ status: 'saving', plan: reviewed.plan });
    await persist(profileId, intake, reviewed.plan, subjectId);
    if (my !== run) return;
    set({ status: 'ready' });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
  } catch (e) {
    if (my !== run) return;
    // A failed critic pass after a saved draft is not fatal: the draft stands.
    if (subjectId) {
      set({ status: 'ready', plan: state.draft });
      return;
    }
    set({ status: 'error', error: aiErrorCopy(e) });
  }
}

// Development only: puts a finished build in place so the path screen can
// be previewed without an account (app/preview.tsx).
export function seedBuildForPreview(intake: Intake, plan: Plan) {
  if (!__DEV__) return;
  run++;
  state = { ...initial, status: 'draft', intake, draft: plan, subjectId: 'fixture', startedAt: Date.now() };
  listeners.forEach((l) => l());
}

// The plan to show right now: the reviewed one if it has landed, else the draft.
export function currentPlan(s: BuildState = state): Plan | null {
  return s.plan ?? s.draft;
}
