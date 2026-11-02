// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

import { arr, nowMs, rid, str } from './core.js';
import { STAGES, stageName } from './ladder.js';

// Structured items (jobs, qualifications, languages, sports, hobbies, fields, tools), confirmed by the learner, are the
// one source of truth. The free-text summary used in prompts is generated from them and stays editable.
const KNOW_KINDS = [['job', 'Jobs'], ['qualification', 'Qualifications and licences'], ['language', 'Languages'], ['sport', 'Sports'], ['hobby', 'Hobbies'], ['field', 'Fields known well'], ['tool', 'Tools and software']];
const knowItems = (know) => arr(know && know.items);
// The fields the learner brought with them, each with a level on the ladder: the level they claim,
// or the one a check from memory showed (marked so the planner can trust it more).
function renderFields(fields) {
  const xs = arr(fields).filter((f) => f && str(f.field)).map((f) => {
    const lvl = str(f.verifiedLevel) || str(f.level);
    const name = (str(f.domain) && str(f.domain).toLowerCase() !== str(f.field).toLowerCase() ? str(f.domain) + ' › ' : '') + str(f.field) + (str(f.area) && str(f.area).toLowerCase() !== str(f.field).toLowerCase() ? ' › ' + str(f.area) : '');
    return name + (lvl ? ' (' + stageName(lvl) + (str(f.verifiedLevel) ? ', shown in a check' : ', self-reported') + ')' : '');
  });
  return xs.length ? 'Fields they know, with their level on the five-rung ladder (' + STAGES.map((s) => s.name).join(', ') + '): ' + xs.join('; ') + '.' : '';
}
function renderKnow(know) {
  const items = knowItems(know);
  const fieldLine = renderFields(know && know.fields);
  if (!items.length && !fieldLine) return '';
  const parts = [];
  if (know.summary) parts.push(know.summary);
  if (fieldLine) parts.push(fieldLine);
  for (const [kind, label] of KNOW_KINDS) {
    const xs = items.filter((i) => i.kind === kind).map((i) => i.text + (i.level ? ' (' + i.level + ')' : ''));
    if (xs.length) parts.push(label + ': ' + xs.join('; ') + '.');
  }
  return parts.join(' ').slice(0, 2400);
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

export { KNOW_KINDS, knowItems, renderKnow, renderFields, mergeKnowItems, withoutKnowItem };
