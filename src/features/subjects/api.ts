import { getSupabase } from '@/src/lib/supabase';
import type { Plan } from '@/src/engine/types';
import type {
  ActivityRow,
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

export async function upsertTopicState(row: Omit<TopicStateRow, 'updated_at'>): Promise<void> {
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
