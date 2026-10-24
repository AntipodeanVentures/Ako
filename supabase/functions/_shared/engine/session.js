// Ported from the Polymath Engine artifact (v4), rewritten as pure functions over a lesson state object.
// The screens hold the state, call these on each event, and render from the result. No React, no DOM, no network:
// anything that needs the model (grading, more practice) is done by the caller, which then passes the answer back in.

import { arr, clampNum, dayKey, nowMs, num, str } from './core.js';
import { CRITERION, HARD, ROLE_LEVEL_GOOD, SUPPORT, pitchOf, supportOf } from './ladder.js';
import { checkMilestones, criterionFor, lessonConceptName, noteConcept, recordMinutes, retentionFor, topicById } from './progress.js';
import { makeCards } from './scheduling.js';

// ---------- lesson state ----------
function newLesson(topicId, logOnly) {
  return { topicId, step: 'loading', data: null, warm: null, answers: [], grades: null, checked: false,
    rated: null, pitchBefore: null, cmp: { text: '', result: null, shown: false }, gapsShown: {},
    rec: { idx: 0, items: [] }, prac: newPractice([], 2), teach: { started: false, skipped: false, turns: 0 },
    jol: null, rest: null, rp: { debrief: null, runs: 0 }, log: { minutes: 20, checks: [] }, logOnly: !!logOnly };
}
function newPractice(items, ability, criterion) {
  return { items: items.slice(), asked: [], idx: null, picked: null, text: '', conf: null, result: null, correct: 0, partial: 0, misses: 0, hardOk: false, mixOk: false, ability, criterion: num(criterion, CRITERION), requeue: [], log: [], why: null, stepBack: false, usedBack: false, confident: 0, extra: 0, re: false };
}
const startAbility = (subj) => [0, 1.5, 2, 3, 4, 4.5][pitchOf(subj)];

// Install a normalised lesson into the state and prepare recall and practice.
function useLesson(L, data, subj) {
  data.practice = arr(data.practice).map((q) => Object.assign({ kind: 'question' }, q, { difficulty: Math.round(clampNum(num(q.difficulty, 3), 1, 5)) }));
  L.data = data;
  L.prac = newPractice(data.practice, startAbility(subj), criterionFor(subj));
  pickNextItem(L.prac);
  L.rec = { idx: 0, items: [{ key: 'recall', prompt: data.recall, answer: data.recallAnswer || 'A clear explanation of the core idea.', text: '', conf: null, result: null }]
    .concat(data.why ? [{ key: 'why', prompt: data.why, answer: data.whyAnswer || 'A clear reason.', text: '', conf: null, result: null }] : []) };
  L.cmp = { text: '', result: null, shown: false };
  L.rp = { debrief: null, runs: 0 };
  L.step = L.warm && !L.checked ? 'attempt' : 'learn';
  return L;
}

// Merge the recall and practice set, written after the lesson text, into an installed lesson.
function addQuestionSet(L, part, subj) {
  const d = L.data;
  if (!d || !part) return L;
  if (str(part.recall)) { d.recall = str(part.recall, 600); d.recallAnswer = str(part.recallAnswer, 1500); }
  if (str(part.why)) { d.why = str(part.why, 600); d.whyAnswer = str(part.whyAnswer, 900); }
  d.practice = arr(part.practice).map((q) => Object.assign({ kind: 'question' }, q, { difficulty: Math.round(clampNum(num(q.difficulty, 3), 1, 5)) }));
  if (arr(part.cards).length) d.cards = arr(part.cards);
  L.prac = newPractice(d.practice, startAbility(subj), criterionFor(subj));
  pickNextItem(L.prac);
  L.rec = { idx: 0, items: [{ key: 'recall', prompt: d.recall, answer: d.recallAnswer || 'A clear explanation of the core idea.', text: '', conf: null, result: null }]
    .concat(d.why ? [{ key: 'why', prompt: d.why, answer: d.whyAnswer || 'A clear reason.', text: '', conf: null, result: null }] : []) };
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
// level, which rises after a right answer and falls after a wrong one, keeping success near four in five. Once two are
// right, practice heads for what mastery still needs: an item that mixes this topic with earlier ones, then a hard
// (transfer) item, so the session does not end on three easy recognitions.
const hasHard = (P) => P.items.some((q) => num(q.difficulty, 3) >= HARD);
const hasMix = (P) => P.items.some((q) => q.mix === true);
// Mastery: CRITERION fully correct answers, including a hard one and a mixed one when the deck offers them.
const metCriterion = (P) => P.correct >= num(P.criterion, CRITERION) && (P.hardOk || !hasHard(P)) && (P.mixOk || !hasMix(P));
function pickNextItem(P) {
  const open = P.items.map((q, i) => i).filter((i) => !P.asked.includes(i));
  if (P.requeue.length && (!open.length || metCriterion(P))) { P.idx = P.requeue.shift(); P.re = true; }
  else if (open.length) {
    let pool = open;
    if (P.correct >= 2) {
      const needMix = P.mixOk ? [] : open.filter((i) => P.items[i].mix === true);
      const needHard = P.hardOk ? [] : open.filter((i) => num(P.items[i].difficulty, 3) >= HARD);
      if (needMix.length) pool = needMix; else if (needHard.length) pool = needHard;
    }
    pool.sort((a, b) => Math.abs(P.items[a].difficulty - P.ability) - Math.abs(P.items[b].difficulty - P.ability) || a - b);
    P.idx = pool[0]; P.re = false;
  }
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
  // Only a fully right answer counts towards the criterion; a partly right one is logged and lowers the working level.
  if (sc >= 1) { P.correct++; if (num(q.difficulty, 3) >= HARD) P.hardOk = true; if (q.mix === true) P.mixOk = true; }
  else if (sc > 0) P.partial++;
  if (sc < 1) { P.misses++; P.ability = clampNum(P.ability - 0.75, 1, 5); } else P.ability = clampNum(P.ability + 0.5, 1, 5);
  if (P.conf === 'sure' && sc < 1) { P.confident++; noteConfidentMiss(subj); if (!P.re) P.requeue.push(P.idx); }
  noteConcept(subj, t.id, q.concept, lessonConceptName(L.data, q.concept), sc >= 1);
  P.log.push({ idx: P.idx, prompt: q.prompt, response: q.type === 'mcq' ? (arr(q.options)[P.picked] || '') : P.text, score: sc, conf: P.conf, difficulty: q.difficulty, re: !!P.re });
  if (!P.usedBack && P.asked.length >= 3 && P.correct / P.asked.length < 0.5) P.stepBack = true;
  return P;
}
const practiceDone = (P) => metCriterion(P);
const practiceExhausted = (P) => P.idx == null && !practiceDone(P);
function addPractice(P, extra) { P.items.push(...extra); P.extra += extra.length; pickNextItem(P); return P; }

// ---------- finishing a topic ----------
// Did this sitting show mastery? Practice topics need the criterion; a role-play needs a debrief at or above the pass
// mark; a topic with no practice at all (nothing came back from the model) is taken on trust rather than blocked.
function masteredThisSitting(L, t) {
  if (isRoleplay(L, t)) return !!(L.rp && L.rp.debrief) && L.rp.debrief.mean >= ROLE_LEVEL_GOOD;
  const P = L.prac;
  if (!P.items.length) return true;
  return metCriterion(P);
}
// The first FSRS rating of a card comes from how its concept went in practice: Good when it was right, Hard when it was
// shaky (under 70 per cent) or the topic as a whole was not mastered, so weak material comes back sooner.
function firstRating(subj, t, card, mastered) {
  const ok = card.concept == null ? null : conceptScore(subj, t.id, card.concept);
  if (!mastered) return 2;
  return ok != null && ok < 0.7 ? 2 : 3;
}
function conceptScore(subj, tid, idx) {
  const c = subj.concepts && subj.concepts[tid + ':' + idx];
  return c && c.n ? c.ok / c.n : null;
}
// Marks the topic mastered (or practising, for a physical skill still to be checked away from the screen; or learning,
// when practice did not reach the criterion, so it is offered again next session in a simpler form), makes the spaced
// cards, fades or restores support, and stamps milestones. Returns what the Done card needs to show.
function finishTopic(subj, L, opts = {}) {
  const t = topicById(subj, L.topicId);
  const st = subj.topicState[t.id] || (subj.topicState[t.id] = {});
  const P = L.prac;
  const mastered = masteredThisSitting(L, t);
  const existing = arr(subj.cards).filter((c) => c.topicId === t.id);
  let added = [];
  if (!existing.length && L.data) {
    const d = dayKey(nowMs());
    added = arr(L.data.cards).map((src, i) => {
      const card = makeCards(t, [src], firstRating(subj, t, src, mastered), retentionFor(subj, opts.retention))[0];
      card.learnedDay = d; card.relearnDays = []; card.concept = src.concept == null ? null : src.concept; card.conceptName = lessonConceptName(L.data, src.concept);
      return card;
    });
    subj.cards = arr(subj.cards).concat(added);
  }
  const motorPending = !!(L.data && L.data.drill) && t.kind === 'motor' && !arr(st.logs).some((l) => l.allChecks);
  st.attempts = num(st.attempts, 0) + 1;
  if (!mastered) {
    st.status = 'learning';
    // The next sitting gets a simpler lesson: the sections this one used tell the model what to simplify.
    st.simpler = arr(L.data && L.data.sections).map((x) => str(x.heading, 160)).filter(Boolean).slice(0, 6);
  } else {
    st.status = motorPending ? 'practising' : 'mastered';
    delete st.simpler;
    if (!motorPending) st.masteredAt = nowMs();
  }
  st.practice = { correct: P.correct, partial: P.partial, asked: P.asked.length, misses: P.misses, confident: P.confident, hardOk: P.hardOk, mixOk: P.mixOk, at: nowMs() };
  if (L.rp && L.rp.debrief) st.roleplay = { mean: L.rp.debrief.mean, runs: L.rp.runs, at: nowMs() };
  st.taught = !!opts.taught && num(L.teach && L.teach.turns, 0) >= 2;
  // Support fades only on real fluency (no misses and a hard item right), and comes back after a rough sitting.
  const sup = supportOf(subj);
  if (mastered && P.misses === 0 && P.hardOk && !P.usedBack) subj.support = SUPPORT[sup].next;
  else if (!mastered || P.misses >= 3 || P.usedBack) subj.support = SUPPORT[sup].prev;
  if (opts.minutes) recordMinutes(subj, 'lesson', opts.minutes);
  checkMilestones(subj);
  L.step = 'done'; L.added = added.length; L.firstDue = added.length ? Math.min.apply(null, added.map((c) => c.due)) : null; L.motorPending = motorPending; L.justMastered = mastered && !motorPending; L.mastered = mastered;
  return { added, motorPending, mastered, firstDue: L.firstDue };
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

export { newLesson, newPractice, startAbility, useLesson, addQuestionSet, isRoleplay, stepOrder, nextStep, sameAnswer, pickNextItem, scorePractice, metCriterion, practiceDone, practiceExhausted, addPractice, masteredThisSitting, finishTopic, recordRelearn };
