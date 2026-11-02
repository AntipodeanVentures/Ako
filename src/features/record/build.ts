import { STAGES } from '@/src/engine/ladder';
import { topicRecall } from '@/src/engine/map';
import { isLearned, isSecure, stagePosition } from '@/src/engine/progress';
import type { StageId } from '@/src/engine/types';
import type { LiveSubject } from '@/src/features/subjects';

// The record of knowledge as data: what the learner can stand behind, built from the same
// state the map and the subjects use. The in-app Record renders it live; sharing freezes one
// as a snapshot under a code, and the public page renders that snapshot. Names and anchors
// are applied when it is drawn, so a snapshot keeps only ids and numbers.

export type RecordField = { id: string; domain: string; field: string; area: string; level: StageId; basis: string; score: number | null; asked: number | null; at: string | null };
export type RecordSubject = { id: string; title: string; reached: StageId | null; working: StageId; learned: number; total: number; secure: number; recall: number | null; marker: string };
export type RecordClaim = { id: string; domain: string; field: string; area: string; level: StageId; basis: string };

export type RecordData = {
  v: 1;
  name: string;
  issued: string;
  retention: number;
  totals: { shown: number; held: number; recall: number | null };
  shown: RecordField[];
  learned: RecordSubject[];
  claimed: RecordClaim[];
};

type PriorField = {
  id: string; domain?: string; field: string; area: string; level: string; basis: string;
  verified_level: string | null; verified_at?: string | null; verified?: { score: number; asked: number } | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function buildRecord({ name, subjects, prior, retention = 0.9, now = new Date() }: { name: string; subjects: LiveSubject[]; prior: PriorField[]; retention?: number; now?: Date }): RecordData {
  const shown: RecordField[] = prior
    .filter((f) => f.verified_level)
    .map((f) => ({ id: f.id, domain: f.domain ?? '', field: f.field, area: f.area, level: f.verified_level as StageId, basis: f.basis, score: f.verified?.score ?? null, asked: f.verified?.asked ?? null, at: f.verified_at ?? null }));
  const claimed: RecordClaim[] = prior.filter((f) => !f.verified_level).map((f) => ({ id: f.id, domain: f.domain ?? '', field: f.field, area: f.area, level: f.level as StageId, basis: f.basis }));
  const learned: RecordSubject[] = subjects
    .map((s) => {
      const pos = stagePosition(s) as { reached: number; currentIdx: number };
      const topics = s.plan.topics.filter((t) => isLearned(s, t));
      const secure = topics.filter((t) => isSecure(s, t)).length;
      const recall = mean(topics.map((t) => topicRecall(s, t, now.getTime(), retention)).filter((r): r is number => typeof r === 'number'));
      const reached = pos.reached >= 0 ? (STAGES[pos.reached].id as StageId) : null;
      const def = reached ? s.plan.stages.find((st) => st.id === reached) : null;
      return { id: s.id, title: s.plan.title, reached, working: STAGES[pos.currentIdx].id as StageId, learned: topics.length, total: s.plan.topics.length, secure, recall, marker: def?.equivalent ?? '' };
    })
    .filter((s) => s.learned > 0);
  const held = learned.reduce((n, s) => n + s.learned, 0);
  const recall = mean(learned.map((s) => s.recall).filter((r): r is number => typeof r === 'number'));
  return { v: 1, name, issued: now.toISOString(), retention, totals: { shown: shown.length, held, recall }, shown, learned, claimed };
}

// A snapshot read back from the database, checked just enough to draw.
export function recordFromSnapshot(x: unknown): RecordData | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Partial<RecordData>;
  if (o.v !== 1 || !Array.isArray(o.shown) || !Array.isArray(o.learned) || !Array.isArray(o.claimed)) return null;
  return o as RecordData;
}
