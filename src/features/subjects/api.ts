import { getSupabase } from '@/src/lib/supabase';
import type { Plan } from '@/src/engine/types';
import type {
  ActivityRow,
  CardRow,
  ProbeItemRow,
  ReviewLogRow,
  StageStateRow,
  SubjectRow,
  TopicStateRow,
} from '@/src/types/database';

export async function fetchSubjects(): Promise<SubjectRow[]> {
  const { data, error } = await getSupabase()
    .from('subjects')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubjectRow[];
}

export type NewSubject = {
  title: string;
  intake: Record<string, unknown>;
  plan: Plan;
  plan_version: number;
  pitch: number | null;
  role_area_id?: string | null;
};

export async function createSubject(profileId: string, subject: NewSubject): Promise<SubjectRow> {
  const { data, error } = await getSupabase()
    .from('subjects')
    .insert({ ...subject, profile_id: profileId })
    .select('*')
    .single();
  if (error) throw error;
  return data as SubjectRow;
}

export async function updateSubject(
  id: string,
  update: Partial<Pick<SubjectRow, 'plan' | 'plan_version' | 'pitch' | 'support' | 'stats' | 'model' | 'role_area_id'>>,
): Promise<void> {
  const { error } = await getSupabase()
    .from('subjects')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await getSupabase().from('subjects').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTopicState(subjectId: string): Promise<TopicStateRow[]> {
  const { data, error } = await getSupabase()
    .from('topic_state')
    .select('*')
    .eq('subject_id', subjectId);
  if (error) throw error;
  return (data ?? []) as TopicStateRow[];
}

export async function upsertTopicState(row: Omit<TopicStateRow, 'updated_at' | 'extra'> & { extra?: Record<string, unknown> }): Promise<void> {
  const { error } = await getSupabase()
    .from('topic_state')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'subject_id,topic_id' });
  if (error) throw error;
}

export async function fetchStageState(subjectId: string): Promise<StageStateRow[]> {
  const { data, error } = await getSupabase()
    .from('stage_state')
    .select('*')
    .eq('subject_id', subjectId);
  if (error) throw error;
  return (data ?? []) as StageStateRow[];
}

export async function upsertStageState(row: StageStateRow): Promise<void> {
  const { error } = await getSupabase()
    .from('stage_state')
    .upsert(row, { onConflict: 'subject_id,stage_id' });
  if (error) throw error;
}

export async function fetchActivity(subjectId: string, sinceDay: string): Promise<ActivityRow[]> {
  const { data, error } = await getSupabase()
    .from('activity')
    .select('*')
    .eq('subject_id', subjectId)
    .gte('day', sinceDay);
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

// Adds minutes to today's row for the subject. Goes through an RPC so two
// quick sessions cannot overwrite each other.
export async function addMinutes(
  subjectId: string,
  day: string,
  kind: 'lesson' | 'review',
  minutes: number,
): Promise<void> {
  const { error } = await getSupabase().rpc('add_activity_minutes', {
    p_subject_id: subjectId,
    p_day: day,
    p_kind: kind,
    p_minutes: minutes,
  });
  if (error) throw error;
}

// ---------- cards and reviews ----------

export async function fetchCards(subjectId?: string): Promise<CardRow[]> {
  let q = getSupabase().from('cards').select('*').order('due', { ascending: true });
  if (subjectId) q = q.eq('subject_id', subjectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CardRow[];
}

export type NewCardRow = Omit<CardRow, 'id' | 'profile_id' | 'created_at'>;

export async function insertCards(profileId: string, rows: NewCardRow[]): Promise<CardRow[]> {
  if (!rows.length) return [];
  const { data, error } = await getSupabase()
    .from('cards')
    .insert(rows.map((r) => ({ ...r, profile_id: profileId })))
    .select('*');
  if (error) throw error;
  return (data ?? []) as CardRow[];
}

export async function updateCard(id: string, update: Partial<Omit<CardRow, 'id' | 'profile_id' | 'subject_id' | 'created_at'>>): Promise<void> {
  const { error } = await getSupabase().from('cards').update(update).eq('id', id);
  if (error) throw error;
}

export async function insertReviewLog(row: Omit<ReviewLogRow, 'id'>): Promise<void> {
  const { error } = await getSupabase().from('review_log').insert(row);
  if (error) throw error;
}

// ---- held-back questions for the retention probe ----
export async function listOpenProbeItems(profileId: string): Promise<ProbeItemRow[]> {
  const { data, error } = await getSupabase().from('probe_items').select('*').eq('profile_id', profileId).is('asked_at', null);
  if (error) throw error;
  return (data ?? []) as ProbeItemRow[];
}
export async function lastProbeAt(profileId: string): Promise<number | null> {
  const { data, error } = await getSupabase().from('probe_items').select('asked_at').eq('profile_id', profileId).not('asked_at', 'is', null).order('asked_at', { ascending: false }).limit(1);
  if (error) throw error;
  const at = (data ?? [])[0]?.asked_at as string | undefined;
  return at ? new Date(at).getTime() : null;
}
// A fresh set replaces any unasked items for the topic; asked ones are history and stay.
export async function replaceProbeItems(profileId: string, subjectId: string, topicId: string, items: unknown[], taught: Record<string, unknown> | null): Promise<void> {
  const db = getSupabase();
  const { error: e1 } = await db.from('probe_items').delete().eq('subject_id', subjectId).eq('topic_id', topicId).is('asked_at', null);
  if (e1) throw e1;
  if (!items.length) return;
  const { error } = await db.from('probe_items').insert(items.map((item) => ({ profile_id: profileId, subject_id: subjectId, topic_id: topicId, item, taught })));
  if (error) throw error;
}
export async function markProbeItem(id: string, score: number, response: string): Promise<void> {
  const { error } = await getSupabase().from('probe_items').update({ asked_at: new Date().toISOString(), score, response: response.slice(0, 2000) }).eq('id', id);
  if (error) throw error;
}
