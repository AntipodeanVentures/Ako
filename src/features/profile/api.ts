import { getSupabase } from '@/src/lib/supabase';
import type { KnowItemRow, Profile } from '@/src/types/database';

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'display_name'
    | 'about'
    | 'voice_on'
    | 'reminder_time'
    | 'study_plan'
    | 'retention'
    | 'new_per_session'
    | 'review_cap'
    | 'model'
  >
>;

export async function updateProfile(id: string, update: ProfileUpdate): Promise<void> {
  const { error } = await getSupabase().from('profiles').update(update).eq('id', id);
  if (error) throw error;
}

export async function fetchKnowItems(): Promise<KnowItemRow[]> {
  const { data, error } = await getSupabase()
    .from('know_items')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KnowItemRow[];
}

export type NewKnowItem = Pick<KnowItemRow, 'kind' | 'title' | 'detail' | 'source'>;

// Items land here only after the learner has confirmed them on screen.
export async function saveKnowItems(profileId: string, items: NewKnowItem[]): Promise<void> {
  if (!items.length) return;
  const rows = items.map((it) => ({ ...it, profile_id: profileId, confirmed_at: new Date().toISOString() }));
  const { error } = await getSupabase().from('know_items').insert(rows);
  if (error) throw error;
}

export async function deleteKnowItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('know_items').delete().eq('id', id);
  if (error) throw error;
}
