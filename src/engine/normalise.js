// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

import { arr, clampNum, nowMs, num, rid, str } from './core.js';
import { PLAN_VERSION, STAGES, START_STAGE, stageIdx, stageName } from './ladder.js';
import { KNOW_KINDS } from './know.js';

// ---------- normalising Claude's answers ----------
const DEFAULT_HOURS = [40, 150, 600, 1500, 5000];
// Level outcomes are shown under "<Level> means you can", so a leading
// "can" or "be able to" from the model would read "you can can explain".
function cleanOutcome(o) {
  const t = str(o, 200).replace(/^(you\s+)?(can|could|will be able to|be able to|is able to|are able to|able to)\s+/i, '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
function normaliseStages(raw, fallback) {
  const given = arr(raw).filter((s) => s && typeof s === 'object');
  const out = STAGES.map((sg, i) => {
    const r = given.find((x) => str(x.id, 10) === sg.id) || given[i] || {};
    const fb = fallback && fallback[i] ? fallback[i] : {};
    return { id: sg.id, means: str(r.means, 400) || str(fb.means, 400) || sg.blurb, basis: str(r.basis, 200) || str(fb.basis, 200), equivalent: str(r.equivalent, 160) || str(fb.equivalent, 160),
      outcomes: arr(r.outcomes).map(cleanOutcome).filter(Boolean).slice(0, 8), external: str(r.external, 300) || str(fb.external, 300),
      hours: Math.round(clampNum(num(r.hours, num(fb.hours, DEFAULT_HOURS[i])), 1, 50000)) };
  });
  for (let i = 1; i < out.length; i++) if (out[i].hours <= out[i - 1].hours) out[i].hours = Math.round(out[i - 1].hours * 2.5);
  return out;
}
function normaliseTopics(rawTopics, msIds, existingIds, defaultStage, startIndex) {
  const idMap = new Map(existingIds.map((id) => [id, id]));
  rawTopics.forEach((t, i) => { const k = str(t.id, 40); if (k && !idMap.has(k)) idMap.set(k, 't' + (startIndex + i + 1)); });
  const kinds = ['concept', 'procedure', 'vocabulary', 'motor', 'strategy', 'roleplay'];
  const valid = new Set(STAGES.map((s) => s.id));
  return rawTopics.map((t, i) => {
    const id = 't' + (startIndex + i + 1);
    const myNum = startIndex + i + 1;
    const prereqs = arr(t.prereqs).map((x) => idMap.get(str(x, 40))).filter((x) => x && Number(x.slice(1)) < myNum);
    const stage = valid.has(str(t.stage, 4)) ? str(t.stage, 4) : defaultStage;
    return {
      id, title: str(t.title, 160) || 'Topic ' + myNum, summary: str(t.summary, 300),
      kind: kinds.includes(t.kind) ? t.kind : 'concept', stage,
      milestone: msIds.get(str(t.milestone, 40)) || null,
      outcome: Number.isInteger(t.outcome) && t.outcome >= 0 && t.outcome < 8 ? t.outcome : null, threshold: t.threshold === true,
      prereqs: Array.from(new Set(prereqs)), minutes: Math.round(clampNum(num(t.minutes, 30), 10, 90))
    };
  });
}
function normalisePlan(raw, intake, coverTo) {
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const stages = normaliseStages(p.stages);
  const valid = new Set(STAGES.map((s) => s.id));
  const startStage = STAGES[START_STAGE[intake.current] || 0].id;
  const msIn = arr(p.milestones).filter((m) => m && typeof m === 'object').slice(0, 10).map((m, i) => ({ id: 'm' + (i + 1), src: str(m.id, 40), title: str(m.title, 160) || 'Milestone ' + (i + 1), test: str(m.test, 300), stage: valid.has(str(m.stage, 4)) ? str(m.stage, 4) : null }));
  if (!msIn.length) msIn.push({ id: 'm1', src: 'm1', title: 'Core skills', test: '', stage: startStage });
  const msMap = new Map(msIn.map((m) => [m.src, m.id]));
  const rawTopics = arr(p.topics).filter((t) => t && typeof t === 'object').slice(0, 40);
  const topics = normaliseTopics(rawTopics, msMap, [], startStage, 0);
  if (topics.length < 3) throw { code: 'invalid_plan' };
  // Every topic needs a milestone; milestones inherit the stage of their topics.
  topics.forEach((t) => { if (!t.milestone) t.milestone = msIn[msIn.length - 1].id; });
  topics.forEach((t) => { if (stageIdx(t.stage) > stageIdx(coverTo || 's5')) t.stage = coverTo; });
  const milestones = msIn.filter((m) => topics.some((t) => t.milestone === m.id)).map((m) => {
    const ts = topics.filter((t) => t.milestone === m.id);
    const stage = m.stage && ts.some((t) => t.stage === m.stage) ? m.stage : ts[0].stage;
    return { id: m.id, title: m.title, test: m.test, stage };
  });
  const types = ['knowledge', 'language', 'physical', 'mixed', 'interpersonal'];
  const lang = typeof p.language === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(p.language) ? p.language : null;
  let th = 0; const maxTh = Math.max(1, Math.floor(topics.length / 5));
  topics.forEach((t) => { if (t.threshold) { th++; if (th > maxTh) t.threshold = false; } });
  return {
    v: 4, title: str(p.title, 80) || intake.subject, changes: arr(p.changes).map((c) => str(c, 240)).filter(Boolean).slice(0, 12),
    subjectType: types.includes(p.subjectType) ? p.subjectType : 'knowledge',
    language: lang, summary: str(p.summary, 600), stages,
    rules: arr(p.rules).map((r) => str(r, 300)).filter(Boolean).slice(0, 8),
    milestones, topics,
    resources: arr(p.resources).filter((r) => r && typeof r === 'object').slice(0, 8).map((r) => ({
      title: str(r.title, 160), creator: str(r.creator, 120), type: str(r.type, 30), why: str(r.why, 200),
      search: str(r.search, 200) || (str(r.title, 160) + ' ' + str(r.creator, 120)).trim()
    })).filter((r) => r.title),
    safety: arr(p.safety).map((x) => str(x, 300)).filter(Boolean).slice(0, 6)
  };
}
function normaliseExtension(raw, plan, stageId) {
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const n0 = plan.milestones.length;
  const msIn = arr(p.milestones).filter((m) => m && typeof m === 'object').slice(0, 6).map((m, i) => ({ id: 'm' + (n0 + i + 1), src: str(m.id, 40), title: str(m.title, 160) || 'Milestone ' + (n0 + i + 1), test: str(m.test, 300), stage: stageId }));
  if (!msIn.length) msIn.push({ id: 'm' + (n0 + 1), src: '', title: stageName(stageId) + ' skills', test: '', stage: stageId });
  const msMap = new Map(msIn.map((m) => [m.src, m.id]));
  const rawTopics = arr(p.topics).filter((t) => t && typeof t === 'object').slice(0, 25);
  const topics = normaliseTopics(rawTopics, msMap, plan.topics.map((t) => t.id), stageId, plan.topics.length);
  if (topics.length < 3) throw { code: 'invalid_plan' };
  topics.forEach((t) => { t.stage = stageId; if (!t.milestone) t.milestone = msIn[msIn.length - 1].id; });
  return { milestones: msIn.filter((m) => topics.some((t) => t.milestone === m.id)).map((m) => ({ id: m.id, title: m.title, test: m.test, stage: m.stage })), topics };
}
// Older plans (before the ladder) are given stages so they still render; the app offers a rebuild.
function upgradePlan(plan, intake) {
  if (plan && plan.v === 3) { plan.stages = normaliseStages(plan.stages); plan.topics.forEach((t) => { if (t.threshold == null) t.threshold = false; if (t.outcome == null) t.outcome = null; }); plan.v = 4; return plan; }
  if (!plan || plan.v >= 4) return plan;
  const target = intake && intake.level === 'advanced' ? 's3' : 's2';
  const hc = num(plan.hoursCompetent, 150), ha = num(plan.hoursAdvanced, 600);
  plan.stages = normaliseStages(null, [{ hours: hc * 0.35 }, { means: plan.competent, hours: hc }, { means: plan.advanced, hours: ha }, { hours: ha * 2.5 }, { hours: ha * 6 }]);
  // Spread the old topics evenly across the stages up to the old target, in plan order, so the ladder means something.
  const n = stageIdx(target) + 1, total = plan.topics.length || 1;
  plan.topics.forEach((t, i) => { if (!t.stage) t.stage = STAGES[Math.min(n - 1, Math.floor((i * n) / total))].id; });
  plan.milestones.forEach((m) => { if (!m.stage) { const first = plan.topics.find((t) => t.milestone === m.id); m.stage = first ? first.stage : target; } });
  plan.legacy = true; plan.v = 4;
  plan.topics.forEach((t) => { t.threshold = false; t.outcome = null; });
  if (intake && !intake.target) intake.target = target;
  return plan;
}
function normQ(q) {
  if (!q || typeof q !== 'object') return null;
  const type = q.type === 'mcq' ? 'mcq' : 'short';
  const prompt = str(q.prompt, 1200);
  if (!prompt) return null;
  const base = { type, prompt, explanation: str(q.explanation, 800), topicId: str(q.topicId, 20), difficulty: Math.round(clampNum(num(q.difficulty, 3), 1, 5)), kind: q.kind === 'decision' ? 'decision' : 'question',
    concept: Number.isInteger(q.concept) && q.concept >= 0 && q.concept < 6 ? q.concept : null, mix: q.mix === true };
  if (type === 'mcq') {
    const options = arr(q.options).map((o) => str(o, 400)).filter(Boolean).slice(0, 6);
    const answer = Math.trunc(num(q.answer, -1));
    if (options.length < 2 || answer < 0 || answer >= options.length) return null;
    return Object.assign(base, { options, answer });
  }
  const answer = str(q.answer, 1200);
  if (!answer) return null;
  return Object.assign(base, { answer });
}
function normaliseLesson(raw, topic) {
  const L = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const sections = arr(L.sections).filter((x) => x && typeof x === 'object').slice(0, 6).map((x) => ({
    heading: str(x.heading, 160),
    paragraphs: arr(x.paragraphs).map((p) => str(p, 2400)).filter(Boolean).slice(0, 8),
    points: arr(x.points).map((p) => str(p, 400)).filter(Boolean).slice(0, 10)
  })).filter((x) => x.paragraphs.length || x.points.length);
  const practice = arr(L.practice).map(normQ).filter(Boolean).slice(0, 10);
  const cards = arr(L.cards).filter((c) => c && typeof c === 'object').map((c) => ({ front: str(c.front, 600), back: str(c.back, 900), concept: Number.isInteger(c.concept) && c.concept >= 0 && c.concept < 6 ? c.concept : null })).filter((c) => c.front && c.back).slice(0, 10);
  const concepts = arr(L.concepts).map((c) => str(c, 120)).filter(Boolean).slice(0, 6);
  const Sc = L.scenario;
  const scenario = Sc && typeof Sc === 'object' && str(Sc.setting) && arr(Sc.criteria).length ? {
    setting: str(Sc.setting, 800), yourRole: str(Sc.yourRole, 200), claudeRole: str(Sc.claudeRole, 300), goal: str(Sc.goal, 400),
    criteria: arr(Sc.criteria).map((x) => str(x, 240)).filter(Boolean).slice(0, 6), opener: str(Sc.opener, 400) } : null;
  if (!sections.length || (practice.length < 2 && !scenario) || !cards.length) throw { code: 'invalid_lesson' };
  if (topic.kind === 'roleplay' && !scenario) throw { code: 'invalid_lesson' };
  const W = L.workedExample;
  const steps = W && typeof W === 'object' ? arr(W.steps).map((x) => str(x, 800)).filter(Boolean).slice(0, 12) : [];
  const worked = steps.length ? { problem: str(W.problem, 1200), steps, gaps: arr(W.gaps).map((g) => Math.trunc(num(g, -1))).filter((g) => g >= 0 && g < steps.length), answer: str(W.answer, 800) } : null;
  const C = L.compare;
  const compare = C && typeof C === 'object' && str(C.a) && str(C.b) ? { a: str(C.a, 1200), b: str(C.b, 1200), question: str(C.question, 300) || 'What do these two have in common, and what makes the difference?', answer: str(C.answer, 900) } : null;
  const D = L.drill;
  const drill = D && typeof D === 'object' && arr(D.steps).length ? {
    steps: arr(D.steps).map((x) => str(x, 400)).filter(Boolean).slice(0, 12), dose: str(D.dose, 300),
    checks: arr(D.checks).map((x) => str(x, 300)).filter(Boolean).slice(0, 5), cues: arr(D.cues).map((x) => str(x, 300)).filter(Boolean).slice(0, 4),
    feedback: str(D.feedback, 400), imagery: str(D.imagery, 1200), safety: str(D.safety, 600)
  } : null;
  return {
    v: 4, stage: 'full', createdAt: nowMs(), concepts, scenario,
    bridge: str(L.bridge, 700), compare,
    sections, workedExample: worked,
    mistakes: arr(L.mistakes).map((m) => str(m, 400)).filter(Boolean).slice(0, 4),
    recall: str(L.recall, 600) || 'Explain ' + topic.title + ' in your own words, and link it to something you already know.',
    recallAnswer: str(L.recallAnswer, 1500),
    why: str(L.why, 600), whyAnswer: str(L.whyAnswer, 900),
    practice, cards, drill,
    resources: arr(L.resources).filter((r) => r && typeof r === 'object').slice(0, 3).map((r) => ({ title: str(r.title, 160), creator: str(r.creator, 120), search: str(r.search, 200) })).filter((r) => r.title)
  };
}
// A warm-up question earns its place only if it can be read once and
// answered: one thing asked, not too long. Anything else is dropped, and
// a warm-up with nothing left is reported as invalid so the lesson goes
// ahead without one.
const WARM_MAX_WORDS = 40;
function normaliseWarm(raw) {
  const W = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const questions = arr(W.questions).filter((q) => q && typeof q === 'object')
    .map((q) => {
      const text = str(q.q || q.question, 400);
      const options = arr(q.options).map((o) => str(o, 80)).filter(Boolean).slice(0, 4);
      const choice = q.type === 'choice' && options.length >= 2;
      const answer = choice && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < options.length ? q.answer : null;
      return { q: text, a: str(q.a || q.answer_text || q.model, 600), purpose: q.purpose === 'predict' ? 'predict' : 'prior', type: choice ? 'choice' : 'short', options: choice ? options : [], answer };
    })
    .filter((q) => q.q && q.a && q.q.split(/\s+/).length <= WARM_MAX_WORDS && (q.q.match(/\?/g) || []).length <= 1)
    .slice(0, 2);
  if (!questions.length) throw { code: 'invalid_json' };
  return { hook: str(W.hook || W.intro, 200), questions };
}
function normaliseRole(raw) {
  const R = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const kinds = ['knowledge', 'skill', 'interpersonal'];
  const valid = new Set(STAGES.map((s) => s.id));
  const areas = arr(R.areas).filter((a) => a && typeof a === 'object').slice(0, 10).map((a, i) => ({
    id: 'a' + (i + 1), title: str(a.title, 120), kind: kinds.includes(a.kind) ? a.kind : 'knowledge', level: valid.has(str(a.level, 4)) ? str(a.level, 4) : 's3', why: str(a.why, 300), subjectId: null,
    have: a.have === true, haveWhy: a.have === true ? str(a.haveWhy, 120) : ''
  })).filter((a) => a.title);
  if (areas.length < 2) throw { code: 'invalid_json' };
  const evidence = arr(R.evidence).map((x) => (typeof x === 'string' ? { text: str(x, 200), done: false, why: '' } : x && typeof x === 'object' ? { text: str(x.text, 200), done: x.done === true, why: x.done === true ? str(x.why, 120) : '' } : null)).filter((x) => x && x.text).slice(0, 8);
  return { summary: str(R.summary, 600), areas, evidence, firstSteps: str(R.firstSteps, 600) };
}
function normaliseKnow(raw) {
  const K = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const kinds = KNOW_KINDS.map((k) => k[0]);
  const items = arr(K.items).filter((i) => i && typeof i === 'object').map((i) => ({ id: rid('k'), kind: kinds.includes(i.kind) ? i.kind : 'field', text: str(i.text, 120), level: str(i.level, 60), keep: true })).filter((i) => i.text).slice(0, 30);
  if (!items.length) throw { code: 'invalid_json' };
  return { summary: str(K.summary, 500), items };
}
function normaliseStart(raw) {
  const R = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const opts = ['Complete beginner', 'Know a little', 'Intermediate', 'Used to be good, now rusty'];
  return { current: opts.includes(R.current) ? R.current : null, background: str(R.background, 1500), why: str(R.why, 300) };
}
// The intake questions: up to three, each with quick answers. If the model
// gives nothing usable, two plain questions stand in so the screen always
// has something worth asking.
const INTAKE_SLOTS = ['why', 'focus', 'background', 'constraint', 'material', 'other'];
const INTAKE_FALLBACK = [
  { slot: 'why', q: 'What do you want to be able to do with this?', options: [], multi: false, effect: 'The use the course is aimed at.' },
  { slot: 'focus', q: 'Is there a part of it you most want to aim at, or all of it?', options: ['All of it'], multi: false, effect: 'Which strand comes first and gets the most time.' },
];
function normaliseIntake(raw) {
  const R = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const questions = arr(R.questions).filter((x) => x && typeof x === 'object').map((x) => ({
    slot: INTAKE_SLOTS.includes(x.slot) ? x.slot : 'other',
    q: str(x.q || x.question, 220),
    options: Array.from(new Set(arr(x.options).map((o) => str(o, 60)).filter(Boolean))).slice(0, 5),
    multi: x.multi === true,
    effect: str(x.effect, 240),
  })).filter((x) => x.q).slice(0, 3);
  return { questions: questions.length ? questions : INTAKE_FALLBACK.map((q) => ({ ...q, options: q.options.slice() })) };
}

// Applies the model's revisions to a copy of the plan's topics. Ids stay as
// they are (cards and topic state point at them); new topics take the next
// free number; started topics are never changed, whatever the model says;
// prerequisites that would point forward are dropped. Returns the new topic
// list, the milestones that still have topics, and one note per change made.
function normaliseAdaptation(raw, plan, subj) {
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const topics = plan.topics.map((t) => Object.assign({}, t, { prereqs: arr(t.prereqs).slice() }));
  const kinds = ['concept', 'procedure', 'vocabulary', 'motor', 'strategy', 'roleplay'];
  const covered = new Set(plan.topics.map((t) => t.stage));
  const state = (subj && subj.topicState) || {};
  const started = (id) => { const st = state[id]; return !!(st && (st.status === 'mastered' || st.status === 'known' || st.status === 'practising' || st.status === 'learning' || num(st.attempts, 0) > 0)); };
  const idx = (id) => topics.findIndex((t) => t.id === id);
  let nextNum = plan.topics.reduce((m, t) => Math.max(m, num(String(t.id).replace(/^t/, ''), 0)), 0) + 1;
  const notes = [];
  for (const c of arr(p.changes).filter((x) => x && typeof x === 'object').slice(0, 6)) {
    const why = str(c.why, 240);
    if (c.op === 'insert' && c.topic && typeof c.topic === 'object') {
      const t = c.topic;
      const after = idx(str(c.after, 20));
      // With no usable anchor, the new topic goes just before the first topic not yet started.
      const at = after >= 0 ? after + 1 : Math.max(0, topics.findIndex((x) => !started(x.id)));
      const neighbour = topics[Math.max(0, Math.min(topics.length - 1, after >= 0 ? after : at))] || {};
      const stage = covered.has(str(t.stage, 4)) ? str(t.stage, 4) : (neighbour.stage || plan.topics[0].stage);
      const nt = {
        id: 't' + nextNum++,
        title: str(t.title, 160) || 'New topic',
        summary: str(t.summary, 300),
        kind: kinds.includes(t.kind) ? t.kind : 'concept',
        stage,
        milestone: neighbour.milestone || (plan.milestones[0] ? plan.milestones[0].id : null),
        outcome: Number.isInteger(t.outcome) && t.outcome >= 0 && t.outcome < 8 ? t.outcome : null,
        threshold: t.threshold === true,
        prereqs: arr(t.prereqs).map((x) => str(x, 20)).filter((x) => idx(x) >= 0),
        minutes: Math.round(clampNum(num(t.minutes, 30), 10, 90)),
      };
      topics.splice(at, 0, nt);
      notes.push({ op: 'insert', id: nt.id, title: nt.title, why });
    } else if (c.op === 'replace') {
      const i = idx(str(c.id, 20));
      if (i < 0 || started(topics[i].id)) continue;
      if (str(c.title)) topics[i].title = str(c.title, 160);
      if (str(c.summary)) topics[i].summary = str(c.summary, 300);
      if (kinds.includes(c.kind)) topics[i].kind = c.kind;
      notes.push({ op: 'replace', id: topics[i].id, title: topics[i].title, why });
    } else if (c.op === 'remove') {
      const i = idx(str(c.id, 20));
      if (i < 0 || started(topics[i].id) || topics.length <= 3) continue;
      const gone = topics.splice(i, 1)[0];
      for (const t of topics) t.prereqs = t.prereqs.filter((x) => x !== gone.id);
      notes.push({ op: 'remove', id: gone.id, title: gone.title, why });
    } else if (c.op === 'move') {
      const i = idx(str(c.id, 20));
      if (i < 0 || started(topics[i].id) || idx(str(c.after, 20)) < 0 || str(c.after, 20) === str(c.id, 20)) continue;
      const t = topics.splice(i, 1)[0];
      topics.splice(idx(str(c.after, 20)) + 1, 0, t);
      notes.push({ op: 'move', id: t.id, title: t.title, why });
    }
  }
  const order = new Map(topics.map((t, i) => [t.id, i]));
  for (const t of topics) t.prereqs = Array.from(new Set(t.prereqs.filter((x) => order.has(x) && order.get(x) < order.get(t.id))));
  const milestones = plan.milestones.filter((m) => topics.some((t) => t.milestone === m.id));
  return { topics, milestones, notes };
}
function normaliseDebrief(raw, n) {
  const D = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const scores = arr(D.scores).map((x) => { const v = num(x, 0); return v >= 0.75 ? 1 : v >= 0.25 ? 0.5 : 0; }).slice(0, n);
  while (scores.length < n) scores.push(0);
  return { scores, feedback: str(D.feedback, 1500), mean: scores.reduce((a, b) => a + b, 0) / Math.max(1, n) };
}
function normaliseModel(raw) {
  const M = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const list = (x) => arr(x).map((s) => str(s, 160)).filter(Boolean).slice(0, 5);
  return { strengths: list(M.strengths), misconceptions: list(M.misconceptions), analogies: list(M.analogies), note: str(M.note, 500), updatedAt: nowMs() };
}

export { DEFAULT_HOURS, cleanOutcome, normaliseStages, normaliseTopics, normalisePlan, normaliseExtension, upgradePlan, normQ, normaliseLesson, normaliseWarm, normaliseRole, normaliseKnow, normaliseStart, INTAKE_SLOTS, INTAKE_FALLBACK, normaliseIntake, normaliseAdaptation, normaliseDebrief, normaliseModel };
