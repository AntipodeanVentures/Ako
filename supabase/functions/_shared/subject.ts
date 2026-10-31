// Loads a subject from the database into the shape the engine's prompts read
// (plan, intake, topic states, concepts, the learner model), for functions
// that do their work after the learner has moved on. Cards are not loaded;
// nothing here needs them.

import type { SupabaseClient } from '@supabase/supabase-js';

export type ServerSubject = {
  id: string;
  profileId: string;
  intake: Record<string, unknown>;
  plan: { title: string; topics: Record<string, unknown>[]; milestones: Record<string, unknown>[]; stages: unknown[]; rules: string[]; history?: unknown[]; [k: string]: unknown };
  topicState: Record<string, Record<string, unknown>>;
  stages: Record<string, unknown>;
  milestones: Record<string, unknown>;
  concepts: Record<string, unknown>;
  stats: Record<string, unknown>;
  model: Record<string, unknown> | null;
  pitch: number | null;
  support: string;
  learner: { about: string; model: Record<string, unknown> | null };
  cards: unknown[];
};

// What the learner's other subjects already cover: each subject's title with
// its topic titles, and which of those are learned. The planner reads this
// (engine `elsewhereLines`) so a learner building several related subjects
// is not taught the same basics in each. `excludeId` leaves out the subject
// being planned; a new subject has no id yet, so its own draft is never in
// the list.
export type Elsewhere = { title: string; topics: string[]; learned: string[] };

export async function loadElsewhere(admin: SupabaseClient, profileId: string, excludeId?: string | null, excludeTitle?: string | null): Promise<Elsewhere[]> {
  const { data: rows } = await admin.from('subjects').select('id, title, plan').eq('profile_id', profileId).order('created_at', { ascending: true });
  // A draft saved moments ago under the same title is this subject, not another one
  // (a client that predates `subjectId` on the review pass sends only the title).
  const skipTitle = (excludeTitle ?? '').trim().toLowerCase();
  const sameTitle = (r: { title?: string; plan?: { title?: string } }) =>
    Boolean(skipTitle) && [r.title, r.plan?.title].some((t) => String(t ?? '').trim().toLowerCase() === skipTitle);
  const others = (rows ?? []).filter((r) => r.id !== excludeId && !sameTitle(r) && r.plan && Array.isArray(r.plan.topics)).slice(0, 8);
  if (!others.length) return [];
  const { data: states } = await admin
    .from('topic_state')
    .select('subject_id, topic_id, status')
    .eq('profile_id', profileId)
    .in('subject_id', others.map((r) => r.id))
    .in('status', ['mastered', 'known']);
  const learnedIds = new Set((states ?? []).map((s) => `${s.subject_id}|${s.topic_id}`));
  return others.map((r) => {
    const topics = (r.plan.topics as { id: string; title: string }[]).filter((t) => t && typeof t.title === 'string');
    return {
      title: String(r.title || r.plan.title || ''),
      topics: topics.map((t) => t.title),
      learned: topics.filter((t) => learnedIds.has(`${r.id}|${t.id}`)).map((t) => t.title),
    };
  });
}

export async function loadSubject(admin: SupabaseClient, profileId: string, subjectId: string): Promise<ServerSubject | null> {
  const { data: row } = await admin.from('subjects').select('*').eq('id', subjectId).eq('profile_id', profileId).maybeSingle();
  if (!row) return null;
  const [{ data: topics }, { data: stages }, { data: prof }] = await Promise.all([
    admin.from('topic_state').select('*').eq('subject_id', subjectId),
    admin.from('stage_state').select('*').eq('subject_id', subjectId),
    admin.from('profiles').select('about, model').eq('id', profileId).maybeSingle(),
  ]);
  const topicState: Record<string, Record<string, unknown>> = {};
  for (const t of topics ?? []) {
    topicState[t.topic_id] = {
      status: t.status,
      correct: Number(t.correct) || 0,
      misses: t.misses,
      masteredAt: t.mastered_at ? new Date(t.mastered_at).getTime() : undefined,
      ...(t.extra ?? {}),
    };
  }
  const stageMap: Record<string, unknown> = {};
  for (const s of stages ?? []) if (s.reached_at) stageMap[s.stage_id] = { at: new Date(s.reached_at).getTime(), placed: s.placed };
  const stats = (row.stats ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    profileId,
    intake: row.intake ?? {},
    plan: row.plan,
    topicState,
    stages: stageMap,
    milestones: (stats.milestones as Record<string, unknown>) ?? {},
    concepts: (stats.concepts as Record<string, unknown>) ?? {},
    stats,
    model: row.model ?? null,
    pitch: row.pitch ?? null,
    support: row.support ?? 'full',
    learner: { about: prof?.about ?? '', model: prof?.model ?? null },
    cards: [],
  };
}
