import { KNOW_KINDS, renderKnow } from '@/src/engine/know';
import { callJson } from '@/src/features/ai/client';
import type { KnowItemRow, Profile } from '@/src/types/database';

import { updateProfile, type NewKnowItem } from './api';

// What the learner already knows, as confirmed items. The free-text
// `about` on the profile, which every prompt reads, is generated from the
// items so the two never drift.

export type ProposedItem = { id: string; kind: KnowItemRow['kind']; text: string; level: string; keep: boolean };

export const KIND_LABELS: Record<string, string> = Object.fromEntries(KNOW_KINDS as [string, string][]);

export async function proposeItems(material: string): Promise<{ summary: string; items: ProposedItem[] }> {
  const r = await callJson<{ know: { summary: string; items: ProposedItem[] } }>('extract', { kind: 'know', material });
  return r.know;
}

export function aboutFrom(items: KnowItemRow[], summary: string): string {
  return renderKnow({ summary, items: items.map((r) => ({ kind: r.kind, text: r.title, level: r.detail })) });
}

// Rewrites profile.about (and keeps the summary beside the learner model) after items change.
export async function recomputeAbout(profile: Profile, items: KnowItemRow[], summary?: string): Promise<void> {
  const model = { ...(profile.model || {}) } as Record<string, unknown>;
  if (summary !== undefined) model.knowSummary = summary;
  const about = aboutFrom(items, String(model.knowSummary || ''));
  await updateProfile(profile.id, { about, model });
}

export function toRows(items: ProposedItem[], source: NewKnowItem['source']): NewKnowItem[] {
  return items.filter((i) => i.keep && i.text.trim()).map((i) => ({ kind: i.kind, title: i.text.trim(), detail: i.level.trim(), source }));
}
