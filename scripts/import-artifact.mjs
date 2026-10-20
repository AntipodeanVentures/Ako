#!/usr/bin/env node
// Imports a subject saved by the Polymath Engine artifact into Ako's tables.
//
// Usage:
//   node scripts/import-artifact.mjs <profile-uuid> subject.json [cards.json] > import.sql
//
// subject.json is the artifact's subject document (data/users/<uid>/subjects/<id>), cards.json the matching cards
// collection exported as an array. The plan is upgraded to the current version with the engine's own upgrade path,
// so an older plan keeps its topics and gains the new fields. Run the SQL in the Supabase SQL editor.

import { readFileSync } from 'node:fs';

import { upgradePlan, normalisePlan, PLAN_VERSION } from '../src/engine/index.js';

const [profileId, subjectPath, cardsPath] = process.argv.slice(2);
if (!profileId || !subjectPath) {
  console.error('usage: import-artifact.mjs <profile-uuid> subject.json [cards.json]');
  process.exit(1);
}
const subj = JSON.parse(readFileSync(subjectPath, 'utf8'));
const cards = cardsPath ? JSON.parse(readFileSync(cardsPath, 'utf8')) : [];

const intake = subj.intake ?? {};
let plan = subj.plan;
plan = plan.v >= PLAN_VERSION ? plan : upgradePlan(normalisePlan(plan, intake, null), intake);

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const j = (o) => q(JSON.stringify(o));
const ts = (ms) => (ms ? `to_timestamp(${Math.round(ms / 1000)})` : 'null');
const day = (ms) => (ms ? `to_timestamp(${Math.round(ms / 1000)})::date` : 'null');

const out = [];
out.push('begin;');
out.push(`insert into public.subjects (id, profile_id, title, intake, plan, plan_version, pitch, support, stats, model, created_at)
values (gen_random_uuid(), ${q(profileId)}, ${q(plan.title)}, ${j(intake)}, ${j(plan)}, ${PLAN_VERSION}, ${subj.pitch ?? 'null'}, ${q(subj.support ?? 'full')}, ${j(subj.stats ?? {})}, ${subj.model ? j(subj.model) : 'null'}, ${ts(subj.createdAt)})
returning id \\gset`);
out.push('-- If your SQL client has no \\gset, replace :\'id\' below with the returned id.');
for (const [tid, st] of Object.entries(subj.topicState ?? {})) {
  const status = ['learning', 'practising', 'mastered', 'known'].includes(st.status) ? st.status : 'learning';
  const extra = { practice: st.practice, roleplay: st.roleplay, logs: st.logs, taught: st.taught };
  out.push(`insert into public.topic_state (subject_id, profile_id, topic_id, status, correct, misses, jol, jol_actual, mastered_at, extra)
values (:'id', ${q(profileId)}, ${q(tid)}, ${q(status)}, ${Number(st.practice?.correct ?? 0)}, ${Number(st.practice?.misses ?? 0)}, ${st.jol ?? 'null'}, ${st.jolActual ?? 'null'}, ${ts(st.masteredAt)}, ${j(extra)});`);
}
for (const [sid, sg] of Object.entries(subj.stages ?? {})) {
  out.push(`insert into public.stage_state (subject_id, profile_id, stage_id, reached_at, score, total, placed)
values (:'id', ${q(profileId)}, ${q(sid)}, ${ts(sg.at)}, ${sg.score ?? 'null'}, ${sg.total ?? 'null'}, ${sg.placed ? 'true' : 'false'});`);
}
for (const [d, m] of Object.entries(subj.stats?.log ?? {})) {
  const r = subj.stats?.rlog?.[d] ?? 0;
  out.push(`insert into public.activity (subject_id, profile_id, day, lesson_minutes, review_minutes) values (:'id', ${q(profileId)}, ${q(d)}, ${Math.max(0, m - r)}, ${r});`);
}
for (const c of cards) {
  const s = c.srs ?? {};
  out.push(`insert into public.cards (profile_id, subject_id, topic_id, front, back, concept, concept_name, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, learned_day, relearn_days, first_review, reviews, created_at)
values (${q(profileId)}, :'id', ${q(c.topicId)}, ${q(c.front)}, ${q(c.back)}, ${c.concept ?? 'null'}, ${c.conceptName ? q(c.conceptName) : 'null'}, ${ts(c.due)}, ${s.stability ?? 0}, ${s.difficulty ?? 0}, ${s.elapsed_days ?? 0}, ${s.scheduled_days ?? 0}, ${s.learning_steps ?? 0}, ${s.reps ?? 0}, ${s.lapses ?? 0}, ${s.state ?? 0}, ${ts(s.last_review)}, ${c.learnedDay ? q(c.learnedDay) : 'null'}, ${q('{' + (c.relearnDays ?? []).join(',') + '}')}, ${c.firstReview ? j(c.firstReview) : 'null'}, ${c.reviews ?? 0}, ${ts(c.createdAt)});`);
}
out.push('commit;');
process.stdout.write(out.join('\n') + '\n');
