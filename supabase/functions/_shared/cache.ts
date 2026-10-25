// The lesson cache: the canonical lesson for a topic at a level is generated once and shared.
// The personal layer (the bridge to what the learner knows, their analogies) is added per learner on top.

import type { Caller } from './auth.ts';

export const PROMPT_VERSION = 'v5';
// The question set has its own version: a change to how questions are written does not throw away cached lesson text.
export const QUESTIONS_VERSION = 'q2';

export async function cacheKey(parts: (string | number)[]): Promise<string> {
  const data = new TextEncoder().encode([PROMPT_VERSION, ...parts].join('\u0001').toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readCache(caller: Caller, key: string): Promise<unknown | null> {
  const { data } = await caller.admin.from('lesson_cache').select('payload, hits').eq('cache_key', key).maybeSingle();
  if (!data) return null;
  await caller.admin.from('lesson_cache').update({ hits: (data.hits ?? 0) + 1 }).eq('cache_key', key);
  return data.payload;
}

export async function writeCache(caller: Caller, key: string, meta: { subjectTitle: string; topicTitle: string; stageId: string; pitchBand: number }, payload: unknown): Promise<void> {
  await caller.admin.from('lesson_cache').upsert({
    cache_key: key, subject_title: meta.subjectTitle, topic_title: meta.topicTitle, stage_id: meta.stageId, pitch_band: meta.pitchBand, payload,
  });
}
