import { callJson } from '@/src/features/ai/client';

import { updateSubject } from './api';
import type { LiveSubject } from './context';

// Every topic has a place on the map of what the learner knows: a field and an
// area ("Physics", "Electricity"). New plans get it from the planner. Plans
// written before that are placed once, all subjects in one call so the names
// agree across them, and the result is saved into each plan.

export type Schema = Record<string, Record<string, string[]>>;

export const topicsWithoutSchema = (subjects: LiveSubject[]) =>
  subjects.reduce((n, s) => n + s.plan.topics.filter((t) => !(t.schema && t.schema.length)).length, 0);

export const needsSchema = (subjects: LiveSubject[]) => topicsWithoutSchema(subjects) > 0;

const unplaced = (s: LiveSubject) => s.plan.topics.some((t) => !(t.schema && t.schema.length));

// The model's answer, keyed by the subject id as it wrote it (or the title, if it used that instead).
function forSubject(schema: Schema, s: LiveSubject): Record<string, string[]> | undefined {
  const want = s.id.toLowerCase();
  const title = s.plan.title.trim().toLowerCase();
  const key = Object.keys(schema).find((k) => k.toLowerCase() === want || k.trim().toLowerCase() === title);
  return key ? schema[key] : undefined;
}

// The field and area names already on the map, so a second pass reuses them.
const fieldsInUse = (subjects: LiveSubject[]) =>
  Array.from(new Set(subjects.flatMap((s) => s.plan.topics.map((t) => (t.schema && t.schema.length ? t.schema.join(' › ') : ''))).filter(Boolean)));

// One call: `send` is what the model sees, `todo` is what gets saved from its answer. The names
// already on the map travel with the call so they are reused.
async function place(all: LiveSubject[], send: LiveSubject[], todo: LiveSubject[]): Promise<LiveSubject[]> {
  const r = await callJson<{ schema: Schema }>('plan', {
    kind: 'schema',
    subjects: send.map((s) => ({ id: s.id, title: s.plan.title, topics: s.plan.topics.map((t) => ({ id: t.id, title: t.title, summary: t.summary })) })),
    fields: fieldsInUse(all),
  });
  const done: LiveSubject[] = [];
  for (const s of todo) {
    const got = forSubject(r.schema, s);
    if (!got) continue;
    let changed = false;
    for (const t of s.plan.topics) {
      if (!(t.schema && t.schema.length) && got[t.id]) { t.schema = got[t.id]; changed = true; }
    }
    if (changed) { await updateSubject(s.id, { plan: s.plan }); done.push(s); }
  }
  return done;
}

export async function assignSchemas(subjects: LiveSubject[]): Promise<Schema> {
  const todo = subjects.filter(unplaced);
  if (!todo.length) return {};
  // Every subject goes in the first time, placed or not, so the grouping is decided across all of them.
  await place(subjects, subjects, todo);
  // A long answer sometimes leaves a subject out; whatever is still unplaced goes again on its own,
  // with the names now on the map to reuse.
  const left = subjects.filter(unplaced);
  if (left.length) await place(subjects, left, left);
  const out: Schema = {};
  for (const s of subjects) out[s.id] = Object.fromEntries(s.plan.topics.filter((t) => t.schema && t.schema.length).map((t) => [t.id, t.schema as string[]]));
  return out;
}
