import { KNOW_KINDS, renderKnow } from '@/src/engine/know';
import { callJson } from '@/src/features/ai/client';
import type { StageId } from '@/src/engine/types';
import type { KnowItemRow, PriorFieldRow, Profile } from '@/src/types/database';

import { updateProfile, type NewKnowItem } from './api';

// What the learner already knows, as confirmed items. The free-text
// `about` on the profile, which every prompt reads, is generated from the
// items so the two never drift.

export type ProposedItem = { id: string; kind: KnowItemRow['kind']; text: string; level: string; keep: boolean };
// A field the extraction placed on the map, with the level it judged from the evidence.
export type ProposedField = { id: string; field: string; area: string; level: StageId; basis: string; keep: boolean };

export const KIND_LABELS: Record<string, string> = Object.fromEntries(KNOW_KINDS as [string, string][]);

// A file goes with the words, or instead of them: a PDF as a document, a photo as an image.
export type Attachment = { image?: { mediaType: string; dataBase64: string }; document?: { mediaType: string; dataBase64: string } };

export async function proposeItems(material: string, fieldsInUse: string[] = [], attachment: Attachment = {}): Promise<{ summary: string; items: ProposedItem[]; fields: ProposedField[] }> {
  const r = await callJson<{ know: { summary: string; items: ProposedItem[]; fields?: ProposedField[] } }>('extract', { kind: 'know', material, fields: fieldsInUse, ...attachment });
  return { ...r.know, fields: r.know.fields ?? [] };
}

export function aboutFrom(items: KnowItemRow[], summary: string, fields: PriorFieldRow[] = []): string {
  return renderKnow({
    summary,
    items: items.map((r) => ({ kind: r.kind, text: r.title, level: r.detail })),
    fields: fields.map((f) => ({ field: f.field, area: f.area, level: f.level, verifiedLevel: f.verified_level ?? '' })),
  });
}

// Rewrites profile.about (and keeps the summary beside the learner model) after items or fields change.
export async function recomputeAbout(profile: Profile, items: KnowItemRow[], summary?: string, fields: PriorFieldRow[] = []): Promise<void> {
  const model = { ...(profile.model || {}) } as Record<string, unknown>;
  if (summary !== undefined) model.knowSummary = summary;
  const about = aboutFrom(items, String(model.knowSummary || ''), fields);
  await updateProfile(profile.id, { about, model });
}

// The names already on the map, from the planner's schemas and the fields confirmed so far, so
// a new extraction reuses them.
export function fieldNamesInUse(fields: PriorFieldRow[], planned: string[] = []): string[] {
  const names = new Set<string>(planned);
  for (const f of fields) names.add(f.area ? `${f.field} › ${f.area}` : f.field);
  return Array.from(names).slice(0, 60);
}

export function toRows(items: ProposedItem[], source: NewKnowItem['source']): NewKnowItem[] {
  return items.filter((i) => i.keep && i.text.trim()).map((i) => ({ kind: i.kind, title: i.text.trim(), detail: i.level.trim(), source }));
}
