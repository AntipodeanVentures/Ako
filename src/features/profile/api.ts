import { getSupabase } from '@/src/lib/supabase';
import type { KnowItemRow, PriorFieldRow, Profile } from '@/src/types/database';

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

// Removes everything the learner owns. Subjects cascade to topic state,
// cards, reviews and activity; items and roles go with them. The final
// step deletes the auth user through the delete_account RPC; if that
// function is not yet installed on the project the content is still gone
// and the account is signed out.
export async function deleteAllMyData(profileId: string): Promise<{ accountDeleted: boolean }> {
  const sb = getSupabase();
  await sb.from('subjects').delete().eq('profile_id', profileId);
  await sb.from('know_items').delete().eq('profile_id', profileId);
  await sb.from('prior_fields').delete().eq('profile_id', profileId);
  await sb.from('roles').delete().eq('profile_id', profileId);
  await sb.from('profiles').update({ about: '', model: null, display_name: '' }).eq('id', profileId);
  const { error } = await sb.rpc('delete_account');
  return { accountDeleted: !error };
}

// ---- the fields the learner brought with them ----

export async function fetchPriorFields(): Promise<PriorFieldRow[]> {
  const { data, error } = await getSupabase().from('prior_fields').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PriorFieldRow[];
}

export type NewPriorField = Pick<PriorFieldRow, 'domain' | 'field' | 'area' | 'level' | 'basis' | 'source'>;

const sameName = (a: { field: string; area: string }, b: { field: string; area: string }) =>
  a.field.trim().toLowerCase() === b.field.trim().toLowerCase() && a.area.trim().toLowerCase() === b.area.trim().toLowerCase();

// Saves confirmed fields. One already on the map (same field and area, any case) is updated
// rather than duplicated; a verified level is never lowered by a new claim.
export async function savePriorFields(profileId: string, fields: NewPriorField[], existing: PriorFieldRow[]): Promise<void> {
  const sb = getSupabase();
  for (const f of fields) {
    const have = existing.find((e) => sameName(e, f));
    if (have) {
      // A domain already placed stays; a new one fills a blank.
      const { error } = await sb.from('prior_fields').update({ level: f.level, basis: f.basis || have.basis, domain: have.domain || f.domain || '', updated_at: new Date().toISOString() }).eq('id', have.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('prior_fields').insert({ ...f, profile_id: profileId });
      if (error) throw error;
    }
  }
}

export async function updatePriorField(id: string, update: Partial<Pick<PriorFieldRow, 'domain' | 'field' | 'area' | 'level' | 'basis' | 'verified_level' | 'verified_at' | 'verified' | 'evidence'>>): Promise<void> {
  const { error } = await getSupabase().from('prior_fields').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deletePriorField(id: string): Promise<void> {
  const { error } = await getSupabase().from('prior_fields').delete().eq('id', id);
  if (error) throw error;
}
