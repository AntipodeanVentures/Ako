import { describe, expect, it, beforeEach } from 'vitest';

import {
  DAY, setNow, nowMs, dayKey,
  STAGES, stageIdx, stageName, START_LEVELS, CRITERION, LEVEL_DELAY,
  normalisePlan, normaliseLesson, normaliseWarm, normaliseRole, normaliseKnow, upgradePlan,
  planPrompt, lessonPrompt, checkPrompt, rolePrompt, startPrompt, learnerLines,
  topicStatus, nextTopic, stageProgress, stagePosition, positionText, levelCheckReady, markStageReached,
  recordMinutes, logReview, retentionRate, estimateStage, estimateText, paceStats, paceBasis, activityDays,
  makeCards, reviewCard, recallChance, dueCards,
  mergeKnowItems, renderKnow, withoutKnowItem,
  newLesson, useLesson, stepOrder, nextStep, pickNextItem, scorePractice, practiceDone, metCriterion, finishTopic, recordRelearn, sameAnswer, ROLE_LEVEL_GOOD,
  normaliseIntake, normaliseAdaptation, reopenTopics, intakePrompt, adaptPrompt,
} from '../index.js';
import { lesson, planPortuguese, planJudo } from '../fixtures.js';

const T0 = Date.parse('2026-10-20T12:00:00');
const intake = { subject: 'Brazilian Portuguese', target: 's3', current: 'Complete beginner', hours: 5, background: '', why: 'Talk to my in-laws', about: 'Structured finance; commercial pilot; jiu-jitsu brown belt.' };

function subjectFrom(plan, extra = {}) {
  return Object.assign({
    id: 'subj_1', intake, plan, topicState: {}, stages: {}, stageChecks: {}, milestones: {}, checks: [],
    stats: { log: {}, rlog: {}, reviewLog: {} }, errors: {}, support: 'full', pitch: null, model: null,
    cards: [], learner: { about: intake.about, model: null },
  }, extra);
}

beforeEach(() => setNow(T0));

describe('ladder', () => {
  it('names five rungs by what you can do, with anchors', () => {
    expect(STAGES.map((s) => s.name)).toEqual(['Beginner', 'Capable', 'Proficient', 'Advanced', 'Expert']);
    expect(stageIdx('s3')).toBe(2);
    expect(stageName('s5')).toBe('Expert');
    expect(STAGES[1].fheq).toContain('CEFR B1');
    expect(START_LEVELS).toHaveLength(4);
  });
});

describe('normalisePlan', () => {
  it('keeps the plan shape, caps the covered stages, and derives milestone stages after the cap', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    expect(plan.title).toBe('Brazilian Portuguese');
    expect(plan.stages).toHaveLength(5);
    expect(plan.stages[0].outcomes.length).toBeGreaterThan(0);
    expect(plan.topics.every((t) => stageIdx(t.stage) <= stageIdx('s2'))).toBe(true);
    // topics are renumbered t1..tn; an unknown prerequisite is dropped, a known one kept
    const past = plan.topics.find((t) => t.title === 'Past tense for telling stories');
    const ser = plan.topics.find((t) => t.title === 'Ser and estar');
    expect(past.prereqs).toEqual([ser.id]);
    // threshold concepts are capped at one in five
    expect(plan.topics.filter((t) => t.threshold).length).toBeLessThanOrEqual(Math.max(1, Math.ceil(plan.topics.length / 5)));
    expect(plan.milestones.every((m) => plan.topics.some((t) => t.milestone === m.id))).toBe(true);
    expect(plan.milestones.every((m) => plan.topics.some((t) => t.stage === m.stage))).toBe(true);
  });
  it('upgrades an older plan to the current version without losing topics', () => {
    const old = normalisePlan(planJudo, { ...intake, subject: 'Judo throws' }, 's1');
    old.v = 3;
    const up = upgradePlan(old, intake);
    expect(up.topics.length).toBe(old.topics.length);
    expect(up.v).toBeGreaterThanOrEqual(4);
  });
});

describe('normaliseLesson', () => {
  it('drops malformed practice items and empty cards, keeps concepts and difficulty tags', () => {
    const t = planPortuguese.topics[0];
    const L = normaliseLesson(lesson('concept'), t);
    expect(L.concepts).toEqual(['Verb endings', 'Subject pronouns']);
    expect(L.practice).toHaveLength(4);
    expect(L.practice.every((q) => q.difficulty >= 1 && q.difficulty <= 5)).toBe(true);
    expect(L.cards).toHaveLength(2);
    expect(L.workedExample.gaps).toEqual([1]);
    expect(L.compare.question).toContain('share');
  });
  it('keeps a role-play scenario and a motor drill', () => {
    const rp = normaliseLesson(lesson('roleplay'), { ...planPortuguese.topics[0], kind: 'roleplay' });
    expect(rp.scenario.criteria.length).toBe(3);
    const mo = normaliseLesson(lesson('motor'), { ...planJudo.topics[0] });
    expect(mo.drill.checks.length).toBe(3);
  });
});

describe('prompts', () => {
  it('plan prompt names the rungs, the frameworks and the learner background', () => {
    const p = planPrompt(intake, 's2');
    expect(p).toContain('s1 Beginner');
    expect(p).toContain('CEFR');
    expect(p).toContain('FHEQ');
    expect(p).toContain('commercial pilot');
    expect(p).toContain('"outcomes"');
  });
  it('lesson and check prompts carry the learner context from the subject', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    subj.learner.model = { analogies: ['verb endings are like belt colours'] };
    const lines = learnerLines(subj);
    expect(lines).toContain('belt colours');
    const lp = lessonPrompt(subj, plan.topics[0], { warm: normaliseWarm({ hook: 'Why?', questions: [{ q: 'Q', a: 'A' }] }), answers: ['guess'] });
    expect(lp).toContain('jiu-jitsu brown belt');
    subj.cards = [{ id: 'c1', topicId: plan.topics[0].id, front: 'Front', back: 'Back', due: T0 }];
    const cp = checkPrompt(subj, plan.topics.slice(0, 2), 's1');
    expect(cp).toContain('Front => Back');
    expect(cp).toContain('LEVEL CHECK');
  });
  it('prompts without a subject take the about text as an argument', () => {
    expect(startPrompt('Chess', 'Club player').includes('Club player')).toBe(true);
    expect(rolePrompt('Product manager', '', 'Marketing, 8 years').includes('Marketing, 8 years')).toBe(true);
    expect(normaliseRole({ summary: 'S', areas: [{ title: 'Writing specs', kind: 'skill', level: 's3', why: 'w', have: true, haveWhy: 'career' }, { title: 'SQL', kind: 'knowledge', level: 's2', why: 'w' }], evidence: ['Shipped a product'], firstSteps: 'Start' }).areas[0].have).toBe(true);
  });
});

describe('progress, checks and estimates', () => {
  it('walks topics in prerequisite order and marks a level only through its check', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    expect(nextTopic(subj).title).toBe('Sounds and nasal vowels');
    expect(topicStatus(subj, plan.topics[1])).toBe('locked');
    for (const t of plan.topics.filter((x) => x.stage === 's1')) subj.topicState[t.id] = { status: 'mastered', masteredAt: T0 - 4 * DAY };
    const prog = stageProgress(subj, 's1');
    expect(prog.complete).toBe(true);
    expect(prog.ready).toBe(true);
    expect(levelCheckReady(subj).id).toBe('s1');
    expect(positionText(subj)).toContain('Beginner level check ready');
    markStageReached(subj, 's1', 3, 3);
    expect(stagePosition(subj).explicit).toBe(0);
    expect(positionText(subj)).toContain('Beginner reached');
  });
  it('waits three days after the last topic before a level check', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    for (const t of plan.topics.filter((x) => x.stage === 's1')) subj.topicState[t.id] = { status: 'mastered', masteredAt: T0 };
    expect(stageProgress(subj, 's1').ready).toBe(false);
    setNow(T0 + LEVEL_DELAY + 1);
    expect(stageProgress(subj, 's1').ready).toBe(true);
  });
  it('estimates from planned hours at first and from measured pace after two weeks', () => {
    const plan = normalisePlan(planPortuguese, intake, 's3');
    const subj = subjectFrom(plan, { createdAt: T0 - 21 * DAY });
    expect(paceStats(subj).measured).toBe(false);
    const first = estimateStage(subj, 's1');
    expect(first && first.weeks).toBeGreaterThan(0);
    for (let i = 20; i >= 1; i--) recordMinutes(subj, 'lesson', 30, T0 - i * DAY);
    expect(paceStats(subj).measured).toBe(true);
    expect(typeof paceBasis(subj)).toBe('string');
    expect(typeof estimateText(subj, 's2')).toBe('string');
    expect(activityDays([subj], 14).filter((d) => d.on).length).toBe(13);
  });
  it('tracks the retention rate from the review log', () => {
    const subj = subjectFrom(normalisePlan(planPortuguese, intake, 's2'));
    logReview(subj, true); logReview(subj, false);
    expect(retentionRate(subj, 28)).toBeNull(); // fewer than ten reviews says nothing yet
    for (let i = 0; i < 10; i++) logReview(subj, i < 7);
    expect(retentionRate(subj, 28)).toBeCloseTo(8 / 12, 5);
  });
});

describe('scheduling', () => {
  it('makes spaced cards, reviews them, and reports what is due', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const L = normaliseLesson(lesson('concept'), plan.topics[0]);
    const cards = makeCards(plan.topics[0], L.cards, 3, 0.9, T0);
    expect(cards).toHaveLength(2);
    expect(cards[0].due).toBeGreaterThan(T0);
    expect(dueCards(cards, T0)).toHaveLength(0);
    expect(dueCards(cards, T0 + 30 * DAY).length).toBe(2);
    const r = reviewCard(cards[0], 3, 0.9, cards[0].due + DAY);
    expect(r.card.srs.reps).toBe(cards[0].srs.reps + 1);
    expect(r.card.due).toBeGreaterThan(cards[0].due);
    const chance = recallChance(cards[0], cards[0].due, 0.9);
    expect(chance).toBeGreaterThan(0.5);
  });
});

describe('what the learner knows', () => {
  it('merges confirmed items without duplicates and renders the summary', () => {
    const k1 = mergeKnowItems(null, [{ kind: 'job', text: 'Marketing manager', level: '8 years' }, { kind: 'language', text: 'French', level: 'conversational' }], 'Eight years in marketing.');
    const k2 = mergeKnowItems(k1, [{ kind: 'job', text: 'marketing manager' }, { kind: 'sport', text: 'Running' }]);
    expect(k2.items).toHaveLength(3);
    const about = renderKnow(k2);
    expect(about).toContain('Jobs: Marketing manager (8 years)');
    expect(about).toContain('Languages: French');
    const k3 = withoutKnowItem(k2, k2.items[0].id);
    expect(k3.items).toHaveLength(2);
    expect(normaliseKnow({ summary: 's', items: [{ kind: 'nonsense', text: 'Chess' }] }).items[0].kind).toBe('field');
  });
});

describe('the session deck', () => {
  it('runs practice in the productive band and finishes the topic with cards', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    const t = plan.topics[0];
    const L = useLesson(newLesson(t.id), normaliseLesson(lesson('concept'), t), subj);
    expect(stepOrder(L, t).map((s) => s.key)).toEqual(['attempt', 'learn', 'recall', 'practice', 'teach', 'done']);
    expect(nextStep({ ...L, step: 'recall' }, t)).toBe('practice');
    const P = L.prac;
    expect(P.idx).not.toBeNull();
    // a confident miss is requeued; three right answers meet the criterion
    P.conf = 'sure';
    scorePractice(L, t, subj, { score: 0, feedback: 'no' });
    expect(P.requeue).toHaveLength(1);
    expect(subj.errors.confident).toBe(1);
    let guard = 0;
    while (!practiceDone(P) && guard++ < 10) { pickNextItem(P); if (P.idx == null) break; P.conf = 'unsure'; scorePractice(L, t, subj, { score: 1, feedback: '' }); }
    expect(practiceDone(P)).toBe(true);
    const done = finishTopic(subj, L, { taught: false, minutes: 12 });
    expect(done.added.length).toBe(2);
    expect(subj.topicState[t.id].status).toBe('mastered');
    expect(subj.cards.length).toBe(2);
    expect(subj.stats.lessonMinutes).toBe(12);
    expect(L.step).toBe('done');
    // the first review on a later day counts towards relearning
    const card = subj.cards[0];
    recordRelearn(subj, card, true, T0 + DAY);
    expect(card.relearnDays).toHaveLength(1);
    expect(card.firstReview.ok).toBe(true);
  });
  it('needs three fully right answers including a hard one and a mixed one before mastery', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    const t = plan.topics[0];
    const L = useLesson(newLesson(t.id), normaliseLesson(lesson('concept'), t), subj);
    const P = L.prac;
    // the deck has a difficulty-4 item and a mix item, so three easy answers are not enough
    const answer = (score) => { P.conf = 'unsure'; scorePractice(L, t, subj, { score, feedback: '' }); pickNextItem(P); };
    answer(1); answer(1);
    // after two right, the picker heads for the mixed item, then the hard one
    expect(P.items[P.idx].mix).toBe(true);
    answer(1);
    expect(P.correct).toBe(3);
    expect(metCriterion(P)).toBe(false);
    expect(P.items[P.idx].difficulty).toBe(4);
    answer(0.5); // partly right: logged, not counted
    expect(P.correct).toBe(3);
    expect(P.partial).toBe(1);
    expect(practiceDone(P)).toBe(false);
  });
  it('leaves a topic in learning when practice falls short, with cards rated hard and a simpler lesson next time', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    const t = plan.topics[0];
    const L = useLesson(newLesson(t.id), normaliseLesson(lesson('concept'), t), subj);
    const P = L.prac;
    P.conf = 'unsure'; scorePractice(L, t, subj, { score: 1, feedback: '' }); pickNextItem(P);
    P.conf = 'unsure'; scorePractice(L, t, subj, { score: 0, feedback: '' });
    const done = finishTopic(subj, L, { minutes: 8 });
    expect(done.mastered).toBe(false);
    expect(subj.topicState[t.id].status).toBe('learning');
    expect(subj.topicState[t.id].masteredAt).toBeUndefined();
    expect(subj.topicState[t.id].simpler).toEqual(['The core idea', 'In practice']);
    expect(nextTopic(subj).id).toBe(t.id);
    // cards exist already, rated Hard, so they come back sooner than a mastered topic's
    expect(subj.cards).toHaveLength(2);
    const good = makeCards(t, [{ front: 'x', back: 'y' }], 3)[0];
    expect(subj.cards[0].due).toBeLessThan(good.due);
    expect(subj.support).toBe('full');
  });
  it('passes a role-play only at the pass mark', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    const t = plan.topics[1];
    t.kind = 'roleplay';
    const L = useLesson(newLesson(t.id), normaliseLesson(lesson('roleplay'), t), subj);
    L.rp = { debrief: { scores: [1, 0.5, 0], feedback: '', mean: 0.5 }, runs: 1 };
    expect(finishTopic(subj, L, {}).mastered).toBe(false);
    expect(subj.topicState[t.id].status).toBe('learning');
    L.rp = { debrief: { scores: [1, 1, 0.5], feedback: '', mean: ROLE_LEVEL_GOOD + 0.1 }, runs: 2 };
    expect(finishTopic(subj, L, {}).mastered).toBe(true);
    expect(subj.topicState[t.id].status).toBe('mastered');
  });
  it('matches typed answers loosely', () => {
    expect(sameAnswer('Bom dia!', 'bom dia')).toBe(true);
    expect(sameAnswer('Boa noite', 'bom dia')).toBe(false);
  });
});

describe('the path adapts', () => {
  it('keeps up to three intake questions with options, and falls back to two plain ones', () => {
    const got = normaliseIntake({ questions: [
      { slot: 'why', q: 'Is this for a trip, for family, or for work?', options: ['A trip', 'Family', 'Work', 'A trip'], multi: true, effect: 'Which situations the examples use.' },
      { slot: 'focus', q: 'Speaking first, or reading and writing too?', options: ['Speaking', 'Both'], multi: false },
      { slot: 'nonsense', q: 'Anything you are following?', options: [], multi: false },
      { slot: 'why', q: 'A fourth question', options: [] },
    ] });
    expect(got.questions).toHaveLength(3);
    expect(got.questions[0].options).toEqual(['A trip', 'Family', 'Work']);
    expect(got.questions[0].multi).toBe(true);
    expect(got.questions[2].slot).toBe('other');
    const fb = normaliseIntake({ questions: [] });
    expect(fb.questions.map((q) => q.slot)).toEqual(['why', 'focus']);
    const prompt = intakePrompt('Brazilian Portuguese', 'Know a little', 's3', 15, intake.about);
    expect(prompt).toContain('at most three');
    expect(prompt).toContain('Never ask about time available');
  });
  it('applies a revision to topics not yet started, keeps ids, and never touches started topics', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    const n = plan.topics.length;
    const [t1, t2, t3] = plan.topics;
    subj.topicState[t1.id] = { status: 'mastered' };
    subj.topicState[t2.id] = { status: 'learning', attempts: 2 };
    const got = normaliseAdaptation({ changes: [
      { op: 'insert', after: t1.id, topic: { title: 'Sounds that trip English speakers', summary: 'The handful of vowel sounds that change meaning.', kind: 'vocabulary', stage: 's1', prereqs: [t1.id], minutes: 20 }, why: 'You kept mixing two sounds, so this comes first.' },
      { op: 'remove', id: t1.id, why: 'should be ignored: mastered' },
      { op: 'replace', id: t2.id, title: 'nope', why: 'should be ignored: in learning' },
      { op: 'replace', id: t3.id, title: 'Ordering food and drink', summary: 'Menus, asking for the bill.', kind: 'roleplay', why: 'You said the trip is the point.' },
      { op: 'move', id: plan.topics[n - 1].id, after: t3.id, why: 'Sooner, for the trip.' },
    ] }, plan, subj);
    expect(got.topics).toHaveLength(n + 1);
    expect(got.topics[1].id).toBe('t' + (n + 1));
    expect(got.topics[1].prereqs).toEqual([t1.id]);
    expect(got.topics[1].milestone).toBe(t1.milestone);
    expect(got.topics.find((t) => t.id === t1.id)).toBeTruthy();
    expect(got.topics.find((t) => t.id === t2.id).title).toBe(t2.title);
    expect(got.topics.find((t) => t.id === t3.id).kind).toBe('roleplay');
    expect(got.topics.findIndex((t) => t.id === plan.topics[n - 1].id)).toBe(got.topics.findIndex((t) => t.id === t3.id) + 1);
    expect(got.notes.map((x) => x.op)).toEqual(['insert', 'replace', 'move']);
    // a prerequisite that now points forward is dropped
    for (const t of got.topics) for (const pr of t.prereqs) expect(got.topics.findIndex((x) => x.id === pr)).toBeLessThan(got.topics.indexOf(t));
    // the prompt lists statuses and the reason
    const prompt = adaptPrompt(subj, { reason: 'A milestone was reached.', note: 'more speaking', evidence: 'x' });
    expect(prompt).toContain('tried 2x');
    expect(prompt).toContain('more speaking');
  });
  it('reopens the topics behind a failed check and brings their cards due', () => {
    const plan = normalisePlan(planPortuguese, intake, 's2');
    const subj = subjectFrom(plan);
    const [t1, t2] = plan.topics;
    subj.topicState[t1.id] = { status: 'mastered', masteredAt: T0 - 5 * 86400000 };
    subj.topicState[t2.id] = { status: 'mastered', masteredAt: T0 - 5 * 86400000 };
    subj.cards = makeCards(t1, [{ front: 'a', back: 'b' }], 3).concat(makeCards(t2, [{ front: 'c', back: 'd' }], 3));
    const back = reopenTopics(subj, [t1.id, 'nope']);
    expect(back.map((t) => t.id)).toEqual([t1.id]);
    expect(subj.topicState[t1.id].status).toBe('learning');
    expect(subj.topicState[t1.id].masteredAt).toBeUndefined();
    expect(subj.topicState[t2.id].status).toBe('mastered');
    expect(subj.cards[0].due).toBeLessThanOrEqual(T0);
    expect(subj.cards[1].due).toBeGreaterThan(T0);
    expect(nextTopic(subj).id).toBe(t1.id);
  });
});

describe('clock', () => {
  it('is pinned in tests', () => {
    expect(nowMs()).toBe(T0);
    expect(dayKey(nowMs())).toBe('2026-10-20');
  });
});
