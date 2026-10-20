// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

import { arr, nowMs, rid } from './core.js';

// Structured items (jobs, qualifications, languages, sports, hobbies, fields, tools), confirmed by the learner, are the
// one source of truth. The free-text summary used in prompts is generated from them and stays editable.
const KNOW_KINDS = [['job', 'Jobs'], ['qualification', 'Qualifications and licences'], ['language', 'Languages'], ['sport', 'Sports'], ['hobby', 'Hobbies'], ['field', 'Fields known well'], ['tool', 'Tools and software']];
const knowItems = (know) => arr(know && know.items);
function renderKnow(know) {
  const items = knowItems(know);
  if (!items.length) return '';
  const parts = [];
  if (know.summary) parts.push(know.summary);
  for (const [kind, label] of KNOW_KINDS) {
    const xs = items.filter((i) => i.kind === kind).map((i) => i.text + (i.level ? ' (' + i.level + ')' : ''));
    if (xs.length) parts.push(label + ': ' + xs.join('; ') + '.');
  }
  return parts.join(' ').slice(0, 1600);
}
// Returns a new know record with the confirmed items merged in (duplicates by kind and text dropped, 60 items at most).
function mergeKnowItems(know, newItems, summary, atMs = nowMs()) {
  const base = know && typeof know === 'object' && !Array.isArray(know) && Array.isArray(know.items) ? know : { items: [], summary: '' };
  const items = base.items.slice();
  const seen = new Set(items.map((i) => (i.kind + '|' + i.text).toLowerCase()));
  for (const it of arr(newItems)) { const k = (it.kind + '|' + it.text).toLowerCase(); if (!seen.has(k)) { seen.add(k); items.push({ id: it.id || rid('k'), kind: it.kind, text: it.text, level: it.level || '' }); } }
  return { items: items.slice(0, 60), summary: summary || base.summary || '', updatedAt: atMs };
}
function withoutKnowItem(know, id) {
  return Object.assign({}, know, { items: knowItems(know).filter((i) => i.id !== id) });
}

export { KNOW_KINDS, knowItems, renderKnow, mergeKnowItems, withoutKnowItem };
