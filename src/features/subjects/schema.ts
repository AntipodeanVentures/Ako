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

export async function assignSchemas(subjects: LiveSubject[]): Promise<Schema> {
  const todo = subjects.filter((s) => s.plan.topics.some((t) => !(t.schema && t.schema.length)));
  if (!todo.length) return {};
  // Every subject goes in, placed or not, so the names already in use are the ones reused.
  const r = await callJson<{ schema: Schema }>('plan', {
    kind: 'schema',
    subjects: subjects.map((s) => ({ id: s.id, title: s.plan.title, topics: s.plan.topics.map((t) => ({ id: t.id, title: t.title, summary: t.summary })) })),
  });
  for (const s of todo) {
    const got = r.schema[s.id];
    if (!got) continue;
    let changed = false;
    for (const t of s.plan.topics) {
      if (!(t.schema && t.schema.length) && got[t.id]) { t.schema = got[t.id]; changed = true; }
    }
    if (changed) await updateSubject(s.id, { plan: s.plan });
  }
  return r.schema;
}
