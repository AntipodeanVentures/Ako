// Ported from the Polymath Engine artifact (v4), rewritten as pure functions over a lesson state object.
// The screens hold the state, call these on each event, and render from the result. No React, no DOM, no network:
// anything that needs the model (grading, more practice) is done by the caller, which then passes the answer back in.

import { arr, clampNum, dayKey, nowMs, num, str } from './core.js';
import { CRITERION, SUPPORT, pitchOf, supportOf } from './ladder.js';
import { checkMilestones, lessonConceptName, noteConcept, recordMinutes, topicById } from './progress.js';
import { makeCards } from './scheduling.js';

// ---------- lesson state ----------
function newLesson(topicId, logOnly) {
  return { topicId, step: 'loading', data: null, warm: null, answers: [], grades: null, checked: false,
    rated: null, pitchBefore: null, cmp: { text: '', result: null, shown: false }, gapsShown: {},
    rec: { idx: 0, items: [] }, prac: newPractice([], 2), teach: { started: false, skipped: false, turns: 0 },
    jol: null, rest: null, rp: { debrief: null, runs: 0 }, log: { minutes: 20, checks: [] }, logOnly: !!logOnly };
}
function newPractice(items, ability) {
  return { items: items.slice(), asked: [], idx: null, picked: null, text: '', conf: null, result: null, correct: 0, misses: 0, ability, requeue: [], log: [], why: null, stepBack: false, usedBack: false, confident: 0, extra: 0, re: false };
}
const startAbility = (subj) => [0, 1.5, 2, 3, 4, 4.5][pitchOf(subj)];

// Install a normalised lesson into the state and prepare recall and practice.
function useLesson(L, data, subj) {
  data.practice = arr(data.practice).map((q) => Object.assign({ kind: 'question' }, q, { difficulty: Math.round(clampNum(num(q.difficulty, 3), 1, 5)) }));
  L.data = data;
  L.prac = newPractice(data.practice, startAbility(subj));
  pickNextItem(L.prac);
  L.rec = { idx: 0, items: [{ key: 'recall', prompt: data.recall, answer: data.recallAnswer || 'A clear explanation of the core idea.', text: '', conf: null, result: null }]
    .concat(data.why ? [{ key: 'why', prompt: data.why, answer: data.whyAnswer || 'A clear reason.', text: '', conf: null, result: null }] : []) };
  L.cmp = { text: '', result: null, shown: false };
  L.rp = { debrief: null, runs: 0 };
  L.step = L.warm && !L.checked ? 'attempt' : 'learn';
  return L;
}

const isRoleplay = (L, t) => t.kind === 'roleplay' && !!(L.data && L.data.scenario);

// The deck's steps for this topic, in order. The screens show one step per card.
function stepOrder(L, t) {
  const steps = [['attempt', 'Warm-up'], ['learn', 'Learn']];
  if (t.kind === 'motor' || (L.data && L.data.drill)) steps.push(['drill', 'Practise away']);
  if (isRoleplay(L, t)) steps.push(['recall', 'Recall'], ['roleplay', 'Role-play'], ['done', 'Done']);
  else steps.push(['recall', 'Recall'], ['practice', 'Practise'], ['teach', 'Teach'], ['done', 'Done']);
  return steps.map(([key, label]) => ({ key, label }));
}
function nextStep(L, t) {
  const order = stepOrder(L, t).map((s) => s.key);
  const i = order.indexOf(L.step);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : 'done';
}

// Plain-text answer match used before asking the model to grade a review.
const sameAnswer = (a, b) => { const n = (x) => str(x).toLowerCase().replace(/[.,!?;:'"()]/g, '').replace(/\s+/g, ' ').trim(); return n(a) && n(a) === n(b); };

// ---------- practice in the productive band ----------
// Items are tagged 1 to 5 for difficulty. The next item is the unanswered one closest to the learner's current working
// level, which rises after a right answer and falls after a wrong one, keeping success near four in five.
function pickNextItem(P) {
  const open = P.items.map((q, i) => i).filter((i) => !P.asked.includes(i));
  if (P.requeue.length && (!open.length || P.correct >= CRITERION)) { P.idx = P.requeue.shift(); P.re = true; }
  else if (open.length) { open.sort((a, b) => Math.abs(P.items[a].difficulty - P.ability) - Math.abs(P.items[b].difficulty - P.ability) || a - b); P.idx = open[0]; P.re = false; }
  else P.idx = null;
  P.picked = null; P.text = ''; P.conf = null; P.result = null; P.why = null;
  return P;
}
function noteConfidentMiss(subj) { subj.errors = subj.errors || {}; subj.errors.confident = (subj.errors.confident || 0) + 1; }

// Record the graded answer for the current item (result = { score, feedback }), update the working level,
// requeue a confident miss, and log it. The caller then shows the feedback and calls pickNextItem when ready.
function scorePractice(L, t, subj, result) {
  const P = L.prac; const q = P.items[P.idx]; const sc = result.score; P.result = result;
  P.asked.push(P.idx);
  P.correct += sc;
  if (sc < 1) { P.misses++; P.ability = clampNum(P.ability - 0.75, 1, 5); } else P.ability = clampNum(P.ability + 0.5, 1, 5);
  if (P.conf === 'sure' && sc < 1) { P.confident++; noteConfidentMiss(subj); if (!P.re) P.requeue.push(P.idx); }
  noteConcept(subj, t.id, q.concept, lessonConceptName(L.data, q.concept), sc >= 1);
  P.log.push({ idx: P.idx, prompt: q.prompt, response: q.type === 'mcq' ? (arr(q.options)[P.picked] || '') : P.text, score: sc, conf: P.conf, difficulty: q.difficulty, re: !!P.re });
  if (!P.usedBack && P.asked.length >= 3 && P.correct / P.asked.length < 0.5) P.stepBack = true;
  return P;
}
const practiceDone = (P) => P.correct >= CRITERION;
const practiceExhausted = (P) => P.idx == null && !practiceDone(P);
function addPractice(P, extra) { P.items.push(...extra); P.extra += extra.length; pickNextItem(P); return P; }

// ---------- finishing a topic ----------
// Marks the topic learned (or practising, for a physical skill still to be checked away from the screen), makes the
// spaced cards, fades or restores support, and stamps milestones. Returns what the Done card needs to show.
function finishTopic(subj, L, opts = {}) {
  const t = topicById(subj, L.topicId);
  const st = subj.topicState[t.id] || (subj.topicState[t.id] = {});
  const P = L.prac;
  const grade = P.misses === 0 ? 3 : 2;
  const existing = arr(subj.cards).filter((c) => c.topicId === t.id);
  let added = [];
  if (!existing.length && L.data) {
    added = makeCards(t, arr(L.data.cards), grade, opts.retention);
    const d = dayKey(nowMs());
    added.forEach((c, i) => { c.learnedDay = d; c.relearnDays = []; const src = L.data.cards[i] || {}; c.concept = src.concept == null ? null : src.concept; c.conceptName = lessonConceptName(L.data, src.concept); });
    subj.cards = arr(subj.cards).concat(added);
  }
  const motorPending = !!(L.data && L.data.drill) && t.kind === 'motor' && !arr(st.logs).some((l) => l.allChecks);
  st.status = motorPending ? 'practising' : 'mastered';
  if (!motorPending) st.masteredAt = nowMs();
  st.practice = { correct: P.correct, asked: P.asked.length, misses: P.misses, confident: P.confident, at: nowMs() };
  if (L.rp && L.rp.debrief) st.roleplay = { mean: L.rp.debrief.mean, runs: L.rp.runs, at: nowMs() };
  st.taught = !!opts.taught && num(L.teach && L.teach.turns, 0) >= 2;
  const sup = supportOf(subj);
  if (P.misses === 0 && !P.usedBack) subj.support = SUPPORT[sup].next; else if (P.misses >= 3 || P.usedBack) subj.support = SUPPORT[sup].prev;
  if (opts.minutes) recordMinutes(subj, 'lesson', opts.minutes);
  checkMilestones(subj);
  L.step = 'done'; L.added = added.length; L.firstDue = added.length ? Math.min.apply(null, added.map((c) => c.due)) : null; L.motorPending = motorPending; L.justMastered = !motorPending;
  return { added, motorPending, firstDue: L.firstDue };
}

// A recalled card on a new day counts towards that topic's relearning (successive relearning: 3 sessions on separate
// days). The first review of every card resolves the learner's prediction (JOL) for the topic.
function recordRelearn(subj, card, ok, atMs = nowMs()) {
  const d = dayKey(atMs);
  if (ok && d !== card.learnedDay) card.relearnDays = Array.from(new Set(arr(card.relearnDays).concat([d]))).slice(-12);
  if (!card.firstReview) {
    card.firstReview = { at: atMs, ok: !!ok };
    const st = subj.topicState[card.topicId];
    if (st && st.jol && st.jolActual == null) {
      const mine = arr(subj.cards).filter((c) => c.topicId === card.topicId);
      if (mine.every((c) => c.firstReview)) st.jolActual = mine.filter((c) => c.firstReview.ok).length / mine.length;
    }
  }
  return card;
}

export { newLesson, newPractice, startAbility, useLesson, isRoleplay, stepOrder, nextStep, sameAnswer, pickNextItem, scorePractice, practiceDone, practiceExhausted, addPractice, finishTopic, recordRelearn };
