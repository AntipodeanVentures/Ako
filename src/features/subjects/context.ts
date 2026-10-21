import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Card, SubjectContext } from '@/src/engine/types';
import type { CardRow, Profile, StageStateRow, SubjectRow, TopicStateRow } from '@/src/types/database';

import {
  addMinutes,
  fetchCards,
  fetchStageState,
  fetchTopicState,
  insertCards,
  insertReviewLog,
  updateCard,
  updateSubject,
  upsertStageState,
  upsertTopicState,
  type NewCardRow,
} from './api';
import { useSubjects } from './hooks';

// The engine works on one plain object per subject (see src/engine/README.md).
// This module builds that object from the rows and writes it back. The
// mapping is deliberately dull: every engine field has one home.
//
//   subj.topicState[tid]   <- topic_state rows (practice, roleplay, taught, logs live in `extra`)
//   subj.stages[sid]       <- stage_state rows with reached_at
//   subj.stageChecks[sid]  <- stage_state.checked_at
//   subj.cards             <- cards rows
//   subj.stats             <- subjects.stats (minutes, log, rlog, reviewLog, plus milestones,
//                             concepts, errors and checks, which are small and change together)
//   subj.learner           <- the profile (about, model)

export type LiveSubject = SubjectContext & {
  createdAt: number;
  stageChecks: Record<string, { at: number }>;
  concepts: Record<string, unknown>;
  errors: Record<string, number>;
  checks: unknown[];
  profileId: string;
  // Ids of cards changed by a review since load, so saving writes only those.
  dirtyCards: Set<string>;
};

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);
const iso = (t: number | null | undefined) => (t == null ? null : new Date(t).toISOString());

export function cardFromRow(r: CardRow): Card {
  return {
    id: r.id,
    topicId: r.topic_id,
    front: r.front,
    back: r.back,
    concept: r.concept,
    conceptName: r.concept_name ?? undefined,
    createdAt: ms(r.created_at) ?? Date.now(),
    due: ms(r.due) ?? Date.now(),
    srs: {
      due: ms(r.due) ?? Date.now(),
      stability: Number(r.stability),
      difficulty: Number(r.difficulty),
      elapsed_days: r.elapsed_days,
      scheduled_days: r.scheduled_days,
      learning_steps: r.learning_steps,
      reps: r.reps,
      lapses: r.lapses,
      state: r.state,
      last_review: ms(r.last_review),
    },
    reviews: r.reviews,
    learnedDay: r.learned_day ?? undefined,
    relearnDays: r.relearn_days ?? [],
    firstReview: r.first_review ?? null,
  };
}

function rowFromCard(c: Card, subjectId: string): NewCardRow {
  return {
    subject_id: subjectId,
    topic_id: c.topicId,
    front: c.front,
    back: c.back,
    concept: c.concept ?? null,
    concept_name: c.conceptName ?? null,
    due: new Date(c.due).toISOString(),
    stability: c.srs.stability,
    difficulty: c.srs.difficulty,
    elapsed_days: c.srs.elapsed_days,
    scheduled_days: c.srs.scheduled_days,
    learning_steps: c.srs.learning_steps,
    reps: c.srs.reps,
    lapses: c.srs.lapses,
    state: c.srs.state,
    last_review: iso(c.srs.last_review),
    learned_day: c.learnedDay ?? null,
    relearn_days: c.relearnDays ?? [],
    first_review: c.firstReview ?? null,
    reviews: c.reviews ?? 0,
  };
}

export function buildSubject(
  row: SubjectRow,
  profile: Profile | null,
  topicRows: TopicStateRow[],
  stageRows: StageStateRow[],
  cardRows: CardRow[],
): LiveSubject {
  const topicState: Record<string, Record<string, unknown>> = {};
  for (const t of topicRows) {
    topicState[t.topic_id] = {
      status: t.status,
      correct: Number(t.correct),
      misses: t.misses,
      relearnDays: t.relearn_days,
      jol: t.jol,
      jolActual: t.jol_actual,
      masteredAt: ms(t.mastered_at),
      ...(t.extra || {}),
    };
  }
  const stages: Record<string, unknown> = {};
  const stageChecks: Record<string, { at: number }> = {};
  for (const s of stageRows) {
    if (s.reached_at) stages[s.stage_id] = { at: ms(s.reached_at), score: s.score, total: s.total, placed: s.placed };
    if (s.checked_at) stageChecks[s.stage_id] = { at: ms(s.checked_at) as number };
  }
  const stats = { ...(row.stats || {}) } as Record<string, unknown>;
  return {
    id: row.id,
    profileId: row.profile_id,
    intake: row.intake,
    plan: row.plan,
    pitch: row.pitch,
    support: row.support,
    model: row.model,
    createdAt: ms(row.created_at) ?? Date.now(),
    topicState,
    stages,
    stageChecks,
    milestones: (stats.milestones as Record<string, unknown>) || {},
    concepts: (stats.concepts as Record<string, unknown>) || {},
    errors: (stats.errors as Record<string, number>) || {},
    checks: (stats.checks as unknown[]) || [],
    stats,
    cards: cardRows.map(cardFromRow),
    learner: { about: profile?.about ?? '', model: profile?.model ?? null },
    dirtyCards: new Set(),
  };
}

// Writes the whole subject back: the row, every topic and stage entry, new
// cards, and the cards touched by reviews. Called at the end of a session
// or a review run, not on every tap.
export async function saveSubject(subj: LiveSubject): Promise<void> {
  const stats = {
    ...subj.stats,
    milestones: subj.milestones,
    concepts: subj.concepts,
    errors: subj.errors,
    checks: subj.checks,
  };
  await updateSubject(subj.id, {
    stats,
    support: subj.support,
    pitch: subj.pitch ?? null,
    model: subj.model ?? null,
  });

  for (const [tid, st] of Object.entries(subj.topicState)) {
    const { status, correct, misses, relearnDays, jol, jolActual, masteredAt, ...extra } = st as Record<string, unknown>;
    if (!status) continue;
    await upsertTopicState({
      subject_id: subj.id,
      profile_id: subj.profileId,
      topic_id: tid,
      status: status as TopicStateRow['status'],
      correct: Number(correct) || 0,
      misses: Number(misses) || 0,
      relearn_days: (relearnDays as string[]) || [],
      jol: (jol as number | null) ?? null,
      jol_actual: (jolActual as number | null) ?? null,
      mastered_at: iso(masteredAt as number | null),
      extra,
    });
  }

  const stageIds = new Set([...Object.keys(subj.stages), ...Object.keys(subj.stageChecks)]);
  for (const sid of stageIds) {
    const reached = subj.stages[sid] as { at?: number; score?: number; total?: number; placed?: boolean } | undefined;
    await upsertStageState({
      subject_id: subj.id,
      profile_id: subj.profileId,
      stage_id: sid,
      reached_at: iso(reached?.at),
      score: reached?.score ?? null,
      total: reached?.total ?? null,
      placed: Boolean(reached?.placed),
      checked_at: iso(subj.stageChecks[sid]?.at),
    });
  }

  const cards = subj.cards ?? [];
  // Engine-made ids start with "c"; database ids are UUIDs.
  const fresh = cards.filter((c) => !c.id.includes('-'));
  if (fresh.length) {
    const inserted = await insertCards(subj.profileId, fresh.map((c) => rowFromCard(c, subj.id)));
    // Swap the temporary cards for the stored ones so later saves update, not insert.
    const byKey = new Map(inserted.map((r) => [r.topic_id + '|' + r.front, r]));
    subj.cards = cards.map((c) => {
      if (c.id.includes('-')) return c;
      const r = byKey.get(c.topicId + '|' + c.front);
      return r ? cardFromRow(r) : c;
    });
  }
  for (const id of subj.dirtyCards) {
    const c = cards.find((x) => x.id === id);
    if (!c || !c.id.includes('-')) continue;
    const { subject_id: _s, topic_id: _t, ...update } = rowFromCard(c, subj.id);
    await updateCard(c.id, update);
  }
  subj.dirtyCards.clear();
}

export async function recordActivity(subjectId: string, kind: 'lesson' | 'review', minutes: number): Promise<void> {
  if (minutes <= 0) return;
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await addMinutes(subjectId, day, kind, Math.round(minutes * 10) / 10);
}

export async function logReviewRow(subj: LiveSubject, cardId: string, log: { rating: number; elapsed_days: number; scheduled_days: number; reviewedAt: number }): Promise<void> {
  if (!cardId.includes('-')) return;
  await insertReviewLog({
    card_id: cardId,
    profile_id: subj.profileId,
    subject_id: subj.id,
    rating: log.rating,
    elapsed_days: Math.round(log.elapsed_days),
    scheduled_days: Math.round(log.scheduled_days),
    reviewed_at: new Date(log.reviewedAt).toISOString(),
  });
}

// ---------- hooks ----------

export function useCards(subjectId?: string) {
  return useQuery({ queryKey: ['cards', subjectId ?? 'all'], queryFn: () => fetchCards(subjectId) });
}

// Every subject as a live engine object, built from the rows the screens
// already load. Re-renders when any of the rows change.
export function useLiveSubjects(profile: Profile | null) {
  const subjects = useSubjects();
  const cards = useCards();
  const ids = (subjects.data ?? []).map((s) => s.id);
  const topicQ = useQuery({
    queryKey: ['topic_state', 'all', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => (await Promise.all(ids.map((id) => fetchTopicState(id)))).flat(),
  });
  const stageQ = useQuery({
    queryKey: ['stage_state', 'all', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => (await Promise.all(ids.map((id) => fetchStageState(id)))).flat(),
  });
  const loading = subjects.isLoading || cards.isLoading || (ids.length > 0 && (topicQ.isLoading || stageQ.isLoading));
  const live = useMemo(() => {
    if (!subjects.data) return [];
    return subjects.data.map((row) =>
      buildSubject(
        row,
        profile,
        (topicQ.data ?? []).filter((t) => t.subject_id === row.id),
        (stageQ.data ?? []).filter((s) => s.subject_id === row.id),
        (cards.data ?? []).filter((c) => c.subject_id === row.id),
      ),
    );
  }, [subjects.data, topicQ.data, stageQ.data, cards.data, profile]);
  return { subjects: live, loading, error: subjects.error ?? cards.error ?? topicQ.error ?? stageQ.error };
}

export function useInvalidateSubject() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['subjects'] });
    qc.invalidateQueries({ queryKey: ['cards'] });
    qc.invalidateQueries({ queryKey: ['topic_state'] });
    qc.invalidateQueries({ queryKey: ['stage_state'] });
  };
}
