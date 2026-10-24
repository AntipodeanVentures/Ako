// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

import { createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';

import { arr, clampNum, nowMs, num, rid, str } from './core.js';

// One scheduler per retention target. The learner's target (0.8 to 0.97) comes from their profile.
const cache = new Map();
function sched(retention = 0.9) {
  const r = clampNum(num(retention, 0.9), 0.8, 0.97);
  let f = cache.get(r);
  if (!f) {
    f = fsrs(generatorParameters({ request_retention: r, enable_fuzz: true, enable_short_term: false, maximum_interval: 3650 }));
    cache.set(r, f);
  }
  return f;
}
// The card's FSRS state is stored as plain numbers (srs). These convert to and from the library's Date-based shape.
function toF(srs) { return Object.assign({}, srs, { due: new Date(srs.due), last_review: srs.last_review ? new Date(srs.last_review) : undefined }); }
function fromF(card) {
  return {
    due: card.due.getTime(), stability: card.stability, difficulty: card.difficulty, elapsed_days: card.elapsed_days || 0,
    scheduled_days: card.scheduled_days, learning_steps: card.learning_steps || 0, reps: card.reps, lapses: card.lapses,
    state: card.state, last_review: card.last_review ? new Date(card.last_review).getTime() : null
  };
}
function recallChance(card, atMs = nowMs(), retention = 0.9) {
  try { return sched(retention).get_retrievability(toF(card.srs), new Date(atMs), false); } catch (e) { return null; }
}
// New cards for a topic, started with one review at `grade` (ts-fsrs Rating: 1 Again, 2 Hard, 3 Good, 4 Easy).
function makeCards(topic, items, grade, retention = 0.9, atMs = nowMs()) {
  const f = sched(retention); const t = new Date(atMs);
  return items.map((c) => {
    const rec = f.next(createEmptyCard(t), t, grade);
    const srs = fromF(rec.card);
    return { id: rid('c'), topicId: topic.id, front: c.front, back: c.back, fronts: arr(c.variants).map((v) => str(v, 400)).filter(Boolean).slice(0, 3), concept: c.concept, createdAt: t.getTime(), due: srs.due, srs, reviews: 0 };
  });
}
// The prompt to show for this review: the card's front the first time, then its variants in turn, so a
// review tests the idea rather than recognition of one wording.
function cardFront(card) {
  const alts = arr(card.fronts).filter(Boolean);
  if (!alts.length) return card.front;
  const i = num(card.reviews, 0) % (alts.length + 1);
  return i === 0 ? card.front : alts[i - 1];
}
// Apply a review. Returns the updated card (a copy) and the log entry.
function reviewCard(card, grade, retention = 0.9, atMs = nowMs()) {
  const f = sched(retention); const now = new Date(atMs);
  const rec = f.next(toF(card.srs), now, grade);
  const srs = fromF(rec.card);
  const next = Object.assign({}, card, { srs, due: srs.due, reviews: (card.reviews || 0) + 1, lastReview: atMs });
  return { card: next, log: { rating: grade, elapsed_days: rec.log.elapsed_days, scheduled_days: rec.log.scheduled_days, reviewedAt: atMs } };
}

export { sched, toF, fromF, recallChance, makeCards, cardFront, reviewCard };
