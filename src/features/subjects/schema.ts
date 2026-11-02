import { callJson } from '@/src/features/ai/client';
import { updatePriorField } from '@/src/features/profile/api';
import type { PriorFieldRow } from '@/src/types/database';

import { updateSubject } from './api';
import type { LiveSubject } from './context';

// Every topic has a place on the map of what the learner knows, in three levels: a domain, a
// discipline and an area ("Physics", "Electromagnetism", "Circuits"). New plans get it from the
// planner. Plans written before that, or in the old two levels, are placed once, all subjects in
// one call so the names agree across them, and the result is saved into each plan. The fields
// the learner brought with them go in the same call and come back with their domain.

export type Schema = Record<string, Record<string, string[]>>;
type FieldPlacement = { domain: string; field: string; area: string };
type Answer = { schema: Schema & { __fields?: Record<string, FieldPlacement> } };

export const LEVELS = 3;

const short = (t: { schema?: string[] }) => !(t.schema && t.schema.length >= LEVELS);

export const topicsWithoutSchema = (subjects: LiveSubject[]) => subjects.reduce((n, s) => n + s.plan.topics.filter(short).length, 0);

export const needsSchema = (subjects: LiveSubject[], prior: PriorFieldRow[] = []) => topicsWithoutSchema(subjects) > 0 || prior.some((f) => !f.domain);

const unplaced = (s: LiveSubject) => s.plan.topics.some(short);

// The model's answer, keyed by the subject id as it wrote it (or the title, if it used that instead).
function forSubject(schema: Schema, s: LiveSubject): Record<string, string[]> | undefined {
  const want = s.id.toLowerCase();
  const title = s.plan.title.trim().toLowerCase();
  const key = Object.keys(schema).find((k) => !k.startsWith('__') && (k.toLowerCase() === want || k.trim().toLowerCase() === title));
  return key ? schema[key] : undefined;
}

// The names already on the map in three levels, so a second pass reuses them.
const fieldsInUse = (subjects: LiveSubject[], prior: PriorFieldRow[]) =>
  Array.from(new Set([
    ...subjects.flatMap((s) => s.plan.topics.map((t) => (t.schema && t.schema.length >= LEVELS ? t.schema.join(' › ') : ''))),
    ...prior.filter((f) => f.domain).map((f) => [f.domain, f.field, f.area].filter(Boolean).join(' › ')),
  ].filter(Boolean)));

// One call: `send` is what the model sees, `todo` is what gets saved from its answer. The names
// already on the map travel with the call so they are reused.
async function place(all: LiveSubject[], send: LiveSubject[], todo: LiveSubject[], prior: PriorFieldRow[], fieldsTodo: PriorFieldRow[]): Promise<void> {
  const r = await callJson<Answer>('plan', {
    kind: 'schema',
    subjects: send.map((s) => ({ id: s.id, title: s.plan.title, topics: s.plan.topics.map((t) => ({ id: t.id, title: t.title, summary: t.summary })) })),
    fields: fieldsInUse(all, prior),
    priorFields: fieldsTodo.map((f) => ({ id: f.id, field: f.field, area: f.area, basis: f.basis })),
  });
  for (const s of todo) {
    const got = forSubject(r.schema, s);
    if (!got) continue;
    let changed = false;
    for (const t of s.plan.topics) {
      if (short(t) && got[t.id] && got[t.id].length >= LEVELS) { t.schema = got[t.id]; changed = true; }
    }
    if (changed) await updateSubject(s.id, { plan: s.plan });
  }
  const placed = r.schema.__fields ?? {};
  for (const f of fieldsTodo) {
    const p = placed[f.id];
    if (!p || !p.domain) continue;
    // The domain is new knowledge; the names the learner confirmed stay as they are, unless the
    // model found a bare name was really an area of a discipline and the field had no area yet.
    const update: Partial<FieldPlacement> = { domain: p.domain };
    if (!f.area && p.field && p.area && p.area.toLowerCase() === f.field.toLowerCase()) { update.field = p.field; update.area = f.field; }
    await updatePriorField(f.id, update);
    Object.assign(f, update);
  }
}

export async function assignSchemas(subjects: LiveSubject[], prior: PriorFieldRow[] = []): Promise<Schema> {
  const todo = subjects.filter(unplaced);
  const fieldsTodo = prior.filter((f) => !f.domain);
  if (!todo.length && !fieldsTodo.length) return {};
  // Every subject goes in the first time, placed or not, so the grouping is decided across all of them.
  await place(subjects, subjects, todo, prior, fieldsTodo);
  // A long answer sometimes leaves a subject out; whatever is still unplaced goes again on its own,
  // with the names now on the map to reuse.
  const left = subjects.filter(unplaced);
  const fieldsLeft = prior.filter((f) => !f.domain);
  if (left.length || fieldsLeft.length) await place(subjects, left, left, prior, fieldsLeft);
  const out: Schema = {};
  for (const s of subjects) out[s.id] = Object.fromEntries(s.plan.topics.filter((t) => t.schema && t.schema.length).map((t) => [t.id, t.schema as string[]]));
  return out;
}
