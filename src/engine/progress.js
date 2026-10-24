// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

import { DAY, arr, clampNum, dayKey, endOfToday, fmtTime, nowMs, num, pct, plural, str } from './core.js';
import { CRITERION, LEVEL_DELAY, LEVEL_PASS, RELEARN_TARGET, ROLE_LEVEL_GOOD, STAGES, START_STAGE, relearnTarget, stageIdx, stageName } from './ladder.js';

const topicById = (subj, tid) => subj.plan.topics.find((t) => t.id === tid) || null;
// Callers attach the learner's context to the subject record: subj.cards (this subject's cards), subj.learner ({ about, model }).
const learnerAbout = (subj) => str(subj && subj.learner && subj.learner.about, 1600);
const learnerModel = (subj) => (subj && subj.learner && subj.learner.model) || {};
const subjectCards = (subj) => arr(subj && subj.cards);

// ---------- topic and stage status ----------
function topicStatus(subj, t) {
  const st = subj.topicState[t.id] || {};
  if (st.status === 'mastered' || st.status === 'known' || st.status === 'practising' || st.status === 'learning') return st.status;
  const ready = t.prereqs.every((p) => { const ps = (subj.topicState[p] || {}).status; return ps === 'mastered' || ps === 'known' || ps === 'practising'; });
  return ready ? 'available' : 'locked';
}
const isLearned = (subj, t) => { const x = topicStatus(subj, t); return x === 'mastered' || x === 'known'; };
const learnedCount = (subj) => subj.plan.topics.filter((t) => isLearned(subj, t)).length;
const studiedCount = (subj) => subj.plan.topics.filter((t) => (subj.topicState[t.id] || {}).status === 'mastered').length;
function nextTopic(subj) {
  for (const want of ['learning', 'available']) { const t = subj.plan.topics.find((x) => topicStatus(subj, x) === want); if (t) return t; }
  return null;
}
const practisingTopics = (subj) => subj.plan.topics.filter((t) => topicStatus(subj, t) === 'practising');
function currentMilestone(subj) { return subj.plan.milestones.find((m) => !subj.milestones[m.id]) || null; }
// Relearning: distinct days, after the day a topic was learned, on which one of its cards was recalled.
function relearnCount(subj, tid) {
  const days = new Set();
  for (const c of subjectCards(subj)) if (c.topicId === tid) for (const d of arr(c.relearnDays)) if (d !== c.learnedDay) days.add(d);
  return days.size;
}
const isSecure = (subj, t) => (subj.topicState[t.id] || {}).status === 'mastered' && relearnCount(subj, t.id) >= relearnTarget(t) + relearnBump(subj);
const secureCount = (subj) => subj.plan.topics.filter((t) => isSecure(subj, t)).length;
function dueCards(cards, endMs = endOfToday()) { return arr(cards).filter((c) => c.due <= endMs); }

const stageTopics = (subj, sid) => subj.plan.topics.filter((t) => t.stage === sid);
// A level is reached when every topic planned for it is learned AND a delayed level check from memory is passed
// (or the placement check showed the whole level was already known).
function stageProgress(subj, sid) {
  const ts = stageTopics(subj, sid);
  const learned = ts.filter((t) => isLearned(subj, t)).length;
  const secure = ts.filter((t) => isSecure(subj, t)).length;
  const complete = ts.length > 0 && learned === ts.length;
  const checked = !!((subj.stages || {})[sid]);
  let eligibleAt = 0;
  if (complete) {
    for (const t of ts) { const st = subj.topicState[t.id] || {}; if (st.status === 'mastered') eligibleAt = Math.max(eligibleAt, (st.masteredAt || 0) + LEVEL_DELAY); }
    const last = ((subj.stageChecks || {})[sid] || {}).at || 0;
    eligibleAt = Math.max(eligibleAt, last ? last + LEVEL_DELAY : 0);
  }
  return { total: ts.length, learned, secure, pct: ts.length ? learned / ts.length : 0, inPlan: ts.length > 0, complete, checked, reached: checked, eligibleAt, ready: complete && !checked && nowMs() >= eligibleAt };
}
// Where the learner stands: the highest stage reached in order, and the stage being worked on.
// Stages below the first planned stage are the learner's starting point (an intermediate starts at Diploma), so they
// count as passed without being claimed as reached.
const firstPlannedIdx = (subj) => subj.plan.topics.reduce((m, t) => Math.min(m, stageIdx(t.stage)), STAGES.length);
function stagePosition(subj) {
  const first = firstPlannedIdx(subj);
  let reached = -1, explicit = -1;
  for (let i = 0; i < STAGES.length; i++) {
    const p = stageProgress(subj, STAGES[i].id);
    if (p.reached) { reached = i; explicit = i; } else if (!p.inPlan && i < first) reached = i; else break;
  }
  const currentIdx = Math.min(reached + 1, STAGES.length - 1);
  const cur = stageProgress(subj, STAGES[currentIdx].id);
  return { reached, explicit, first, reachedId: reached >= 0 ? STAGES[reached].id : null, currentIdx, currentId: STAGES[currentIdx].id, pct: cur.pct, inPlan: cur.inPlan, complete: cur.complete, ready: cur.ready, eligibleAt: cur.eligibleAt, done: reached === STAGES.length - 1 };
}
const isSkippedStage = (subj, i) => { const pos = stagePosition(subj); return i <= pos.reached && i > pos.explicit && !stageProgress(subj, STAGES[i].id).inPlan; };
const daysUntil = (ms) => Math.max(1, Math.ceil((ms - nowMs()) / DAY));
function positionText(subj) {
  const p = stagePosition(subj);
  if (p.done) return 'Expert level reached';
  const cur = STAGES[p.currentIdx].name;
  const prefix = p.explicit >= 0 ? STAGES[p.explicit].name + ' reached · ' : '';
  if (!p.inPlan) return (p.explicit >= 0 ? STAGES[p.explicit].name + ' reached' : 'Starting out') + ' · ' + cur + ' not planned yet';
  if (p.complete) return prefix + cur + (p.ready ? ' level check ready' : ' level check in ' + plural(daysUntil(p.eligibleAt), 'day'));
  return prefix + cur + ' ' + pct(p.pct);
}
// The first level whose topics are all learned and whose delayed check is now open.
function levelCheckReady(subj) {
  for (const sg of STAGES) { const p = stageProgress(subj, sg.id); if (p.inPlan && !p.reached) return p.ready ? sg : null; }
  return null;
}
function coveredStage(plan) { let top = -1; for (const t of plan.topics) top = Math.max(top, stageIdx(t.stage)); return top >= 0 ? STAGES[top].id : null; }

function dayAgo(i) { const d = new Date(nowMs()); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); return dayKey(d.getTime()); }
function minutesSince(subj, days, key) {
  const from = dayAgo(days - 1);
  let m = 0; for (const [k, v] of Object.entries(subj.stats[key || 'log'] || {})) if (k >= from) m += v;
  return m;
}
function checkEligible(subj) {
  const cutoff = nowMs() - 3 * DAY;
  const topics = subj.plan.topics.filter((t) => { const st = subj.topicState[t.id] || {}; return st.status === 'mastered' && (st.masteredAt || 0) <= cutoff; });
  const last = arr(subj.checks).length ? subj.checks[subj.checks.length - 1].at : 0;
  return topics.length >= 2 && nowMs() - last >= 6 * DAY ? topics : null;
}
// After a failed level check, the topics behind the wrong answers go back to
// learning, so they come first next session, and their cards come due now.
// Returns the topics reopened.
function reopenTopics(subj, topicIds, reason) {
  const ids = new Set(arr(topicIds));
  const reopened = [];
  for (const t of subj.plan.topics) {
    if (!ids.has(t.id)) continue;
    const st = subj.topicState[t.id] || (subj.topicState[t.id] = {});
    if (st.status !== 'mastered' && st.status !== 'known') continue;
    st.status = 'learning';
    st.reopenedAt = nowMs();
    // The next lesson is told why it is being taught again, and is written afresh rather than served from the cache.
    st.relearn = str(reason, 300) || 'forgotten';
    delete st.masteredAt;
    reopened.push(t);
  }
  const now = nowMs();
  for (const c of subjectCards(subj)) if (ids.has(c.topicId) && c.due > now) { c.due = now; if (subj.dirtyCards && subj.dirtyCards.add) subj.dirtyCards.add(c.id); }
  return reopened;
}
// The placement check: topics answered right are marked known, so they are
// skipped, and a whole level known counts as reached. Returns the topics placed.
function placeKnown(subj, topicIds) {
  const ids = new Set(arr(topicIds));
  const placed = [];
  for (const t of subj.plan.topics) {
    if (!ids.has(t.id)) continue;
    const st = subj.topicState[t.id] || (subj.topicState[t.id] = {});
    if (st.status === 'mastered' || st.status === 'known') continue;
    st.status = 'known';
    st.knownAt = nowMs();
    placed.push(t);
  }
  subj.placement = { at: nowMs(), placed: placed.map((t) => t.id) };
  checkMilestones(subj, true);
  return placed;
}
// Returns the milestones newly reached, so the caller can tell the learner.
function checkMilestones(subj, viaPlacement) {
  const reached = [];
  subj.milestones = subj.milestones || {};
  for (const m of subj.plan.milestones) {
    if (subj.milestones[m.id]) continue;
    const ts = subj.plan.topics.filter((t) => t.milestone === m.id);
    if (ts.length && ts.every((t) => isLearned(subj, t))) {
      subj.milestones[m.id] = { at: nowMs(), minutes: subj.stats.minutes || 0, placed: !!viaPlacement };
      if (!viaPlacement) reached.push(m);
    }
  }
  // A whole level shown as already known by the placement check counts as reached; otherwise the level check decides.
  subj.stages = subj.stages || {};
  if (viaPlacement) for (const sg of STAGES) {
    if (subj.stages[sg.id]) continue;
    const ts = stageTopics(subj, sg.id);
    if (ts.length && ts.every((t) => (subj.topicState[t.id] || {}).status === 'known')) subj.stages[sg.id] = { at: nowMs(), minutes: subj.stats.minutes || 0, placed: true };
  }
  return reached;
}
function markStageReached(subj, sid, score, total) {
  subj.stages = subj.stages || {};
  subj.stages[sid] = { at: nowMs(), minutes: subj.stats.minutes || 0, score, total };
  return STAGES[stageIdx(sid)];
}

// ---------- time on task ----------
// Gaps of up to 6 minutes between actions count as study time. Lesson and review time are kept apart for the pace estimate.
// Minutes studied, recorded by the caller (the app measures active time on screen).
function recordMinutes(subj, kind, minutes, atMs = nowMs()) {
  const m = num(minutes, 0);
  if (!subj || m <= 0) return;
  const k = kind === 'review' ? 'review' : 'lesson';
  const st = subj.stats = subj.stats || {};
  st.minutes = (st.minutes || 0) + m;
  if (k === 'review') st.reviewMinutes = (st.reviewMinutes || 0) + m; else st.lessonMinutes = (st.lessonMinutes || 0) + m;
  st.lastStudied = atMs;
  const d = dayKey(atMs);
  st.log = st.log || {}; st.log[d] = (st.log[d] || 0) + m;
  if (k === 'review') { st.rlog = st.rlog || {}; st.rlog[d] = (st.rlog[d] || 0) + m; }
  for (const key of ['log', 'rlog']) { const keys = Object.keys(st[key] || {}).sort(); while (keys.length > 400) delete st[key][keys.shift()]; }
}
function logReview(subj, ok) {
  const d = dayKey(nowMs());
  subj.stats.reviewLog = subj.stats.reviewLog || {};
  const r = subj.stats.reviewLog[d] || (subj.stats.reviewLog[d] = { n: 0, ok: 0 });
  r.n++; if (ok) r.ok++;
  const keys = Object.keys(subj.stats.reviewLog).sort(); while (keys.length > 200) delete subj.stats.reviewLog[keys.shift()];
}

// ---------- pace and live estimates ----------
// The subject sets the size of the job (Claude's hour estimates and the topic list); the learner's own measured pace,
// progress and retention set the timeline. Nothing here is typed in by the learner except the planned hours, which
// only matter until two weeks of real data exist.
function retentionRate(subj, days) {
  const from = dayAgo((days || 28) - 1);
  let n = 0, ok = 0;
  for (const [k, v] of Object.entries(subj.stats.reviewLog || {})) if (k >= from) { n += v.n; ok += v.ok; }
  return n >= 10 ? ok / n : null;
}
function paceStats(subj) {
  const planned = clampNum(num(subj.intake.hours, 5), 1, 60) * 60;
  const ageDays = Math.max(1, (nowMs() - (subj.createdAt || nowMs())) / DAY);
  const window = Math.min(28, Math.ceil(ageDays));
  const recent = minutesSince(subj, window);
  const measured = ageDays >= 14 && recent > 0;
  const weekly = measured ? recent / (window / 7) : planned;
  const reviewWeekly = measured ? minutesSince(subj, window, 'rlog') / (window / 7) : 0;
  const studied = studiedCount(subj);
  const planAvg = subj.plan.topics.length ? subj.plan.topics.reduce((n, t) => n + num(t.minutes, 30), 0) / subj.plan.topics.length : 30;
  const perTopicPlan = planAvg * 1.6;   // warm-up, recall, practice and teaching back roughly add 60% to the reading time
  const perTopicMeasured = studied >= 2 && subj.stats.lessonMinutes / studied >= 5;   // at least two topics with real time behind them
  const perTopic = perTopicMeasured ? subj.stats.lessonMinutes / studied : perTopicPlan;
  const rate = clampNum(perTopic / perTopicPlan, 0.5, 2.5);
  const r = retentionRate(subj);
  const factor = r == null || r >= 0.85 ? 1 : Math.min(1.6, 1 + (0.85 - r) * 2);
  return { planned, weekly, reviewWeekly, measured, window, perTopic, perTopicMeasured, perTopicPlan, rate, retention: r, factor, studied };
}
function paceBasis(subj) {
  const p = paceStats(subj);
  const parts = [];
  parts.push(p.measured ? fmtHours(p.weekly) + ' a week over the last ' + (p.window >= 28 ? '4 weeks' : Math.round(p.window) + ' days') : 'your planned ' + fmtHours(p.planned) + ' a week (measured pace takes over after two weeks)');
  parts.push(p.perTopicMeasured ? fmtTime(p.perTopic) + ' per topic' : 'about ' + fmtTime(p.perTopic) + ' per topic until measured');
  if (p.retention != null) parts.push(pct(p.retention) + ' of reviews recalled' + (p.factor > 1 ? ', which adds relearning time' : ''));
  return 'Based on ' + parts.join(', ') + '.';
}
// Minutes of study still needed to reach a stage: the unlearned planned topics at the learner's measured pace. Stages
// not yet planned are sized from the subject's typical hours, scaled by how the planned topics compare with the
// typical hours for their own stages, so every date is on the same scale (time in these lessons and reviews).
const stageHours = (plan, id) => num((arr(plan.stages).find((x) => x.id === id) || {}).hours, 0);
function remainingMinutes(subj, stageId) {
  const p = paceStats(subj);
  const target = stageIdx(stageId);
  let mins = 0;
  for (const t of subj.plan.topics) if (stageIdx(t.stage) <= target && !isLearned(subj, t)) mins += p.perTopic;
  const covered = coveredStage(subj.plan);
  const coveredIdx = covered ? stageIdx(covered) : -1;
  if (target > coveredIdx) {
    const typicalCovered = coveredIdx >= 0 ? stageHours(subj.plan, STAGES[coveredIdx].id) * 60 : 0;
    const plannedMinutes = subj.plan.topics.length * p.perTopic;
    const ratio = typicalCovered > 0 ? clampNum(plannedMinutes / typicalCovered, 0.03, 1) : 0.2;
    const from = coveredIdx >= 0 ? stageHours(subj.plan, STAGES[coveredIdx].id) : 0;
    mins += Math.max(0, stageHours(subj.plan, STAGES[target].id) - from) * 60 * ratio;
  }
  return mins * p.factor;
}
function estimateStage(subj, stageId) {
  const prog = stageProgress(subj, stageId);
  if (prog.reached || stagePosition(subj).reached >= stageIdx(stageId)) return null;
  const p = paceStats(subj);
  const mins = remainingMinutes(subj, stageId);
  const perWeek = Math.max(30, p.weekly - Math.min(p.reviewWeekly, p.weekly * 0.6));
  // Study time, plus the wait for the delayed level check once the last topic is learned.
  const weeks = mins / perWeek + (mins > 0 ? LEVEL_DELAY / (7 * DAY) : Math.max(0, prog.eligibleAt - nowMs()) / (7 * DAY));
  const at = nowMs() + weeks * 7 * DAY;
  return { weeks, at, lo: nowMs() + weeks * 0.75 * 7 * DAY, hi: nowMs() + weeks * 1.3 * 7 * DAY, planned: stageIdx(stageId) <= (coveredStage(subj.plan) ? stageIdx(coveredStage(subj.plan)) : -1), checkOnly: prog.complete };
}
const fmtMonth = (ms) => new Date(ms).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
function fmtWeeks(w) {
  if (w < 1) return 'under a week';
  if (w < 9) { const n = Math.round(w); return n === 1 ? 'about a week' : 'about ' + n + ' weeks'; }
  if (w < 78) { const n = Math.round(w / 4.345); return n === 1 ? 'about a month' : 'about ' + n + ' months'; }
  // Years in words: "1.6 years" reads like a spreadsheet.
  const y = w / 52;
  if (y < 1.25) return 'about a year';
  if (y < 1.75) return 'about a year and a half';
  if (y < 2.25) return 'about two years';
  if (y < 2.75) return 'about two and a half years';
  return 'about ' + Math.round(y) + ' years';
}
// A plain date for a moment that far off: a month soon, a part of a year later.
function fmtWhen(ms) {
  const d = new Date(ms), now = new Date(nowMs());
  const weeksAway = (ms - nowMs()) / (7 * DAY);
  if (weeksAway < 26) return d.toLocaleDateString('en-GB', d.getFullYear() === now.getFullYear() ? { month: 'long' } : { month: 'short', year: 'numeric' });
  const m = d.getMonth();
  return (m < 4 ? 'early ' : m < 8 ? 'mid-' : 'late ') + d.getFullYear();
}
function fmtHours(min) { const hh = min / 60; return (hh < 10 ? hh.toFixed(1) : Math.round(hh)) + ' h'; }
function estimateText(subj, stageId) {
  const e = estimateStage(subj, stageId);
  if (!e) return null;
  if (e.checkOnly) { const prog = stageProgress(subj, stageId); return prog.ready ? 'level check ready now' : 'level check in ' + plural(daysUntil(prog.eligibleAt), 'day'); }
  const lo = fmtMonth(e.lo), hi = fmtMonth(e.hi);
  return fmtWeeks(e.weeks) + ' (' + (lo === hi ? lo : lo + ' to ' + hi) + ')';
}
// The next stage the learner has not reached, for the Today card.
function nextStageEstimate(subj) {
  const pos = stagePosition(subj);
  if (pos.done) return null;
  const id = STAGES[pos.currentIdx].id;
  const txt = estimateText(subj, id);
  return txt ? { id, name: STAGES[pos.currentIdx].name, text: txt, inPlan: pos.inPlan } : null;
}
// Study days across all subjects, newest last.
function activityDays(subjects, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = dayAgo(i); out.push({ day: d, on: arr(subjects).some((x) => ((x.stats || {}).log || {})[d] > 0) }); }
  return out;
}

// ---------- evidence that learning stuck: held-back questions asked weeks later ----------
// A topic counts as learned after practice in the sitting. Whether it stayed learned is a different
// question, answered by questions the learner has never seen, asked two to six weeks on. Those
// results calibrate the mastery bar and the review schedule for this subject.
// Timing follows the spacing literature rather than the calendar. Cepeda et al. (2008) found the best
// gap before a later test scales with how long the memory must last: about three weeks for a year.
// So each mastered topic is probed twice: once around three weeks after mastery (the window opens at
// two) and once about five weeks after that, giving two points on its forgetting curve. A check is
// offered whenever three or more items are in their window; checks are at least three days apart
// only so they bundle into one short sitting.
const PROBE_FIRST_DAYS = 14;    // the first window opens two weeks after mastery
const PROBE_FIRST_TARGET = 21;  // and is due at three
const PROBE_SECOND_GAP = 35;    // the second probe five weeks after the first
const PROBE_MAX = 2;            // two points on the curve; the review schedule carries the rest
const PROBE_MIN_GAP_DAYS = 3;   // checks bundle into sittings at least this far apart
const PROBE_PER_TOPIC = 2;
const PROBE_SIZE = 5;
const PROBE_MIN_ITEMS = 3;      // fewer than this and it is not worth the sitting
const CALIBRATE_AFTER = 6;      // probe answers before the schedule moves

function probeDue(lastProbeAt, now = nowMs()) { return !lastProbeAt || now - lastProbeAt >= PROBE_MIN_GAP_DAYS * DAY; }
// When a topic's next probe falls due, or null when it has had its two.
function probeDueAt(st) {
  if (!st || st.status !== 'mastered' || !st.masteredAt) return null;
  const n = num(st.retained && st.retained.n, 0);
  if (n >= PROBE_MAX) return null;
  return n === 0 ? st.masteredAt + PROBE_FIRST_TARGET * DAY : num(st.retained.at, st.masteredAt) + PROBE_SECOND_GAP * DAY;
}
// Topics whose probe window is open, most overdue first.
function probeCandidates(subj, now = nowMs()) {
  return subj.plan.topics.filter((t) => {
    const st = subj.topicState[t.id] || {};
    const due = probeDueAt(st);
    if (due == null) return false;
    const n = num(st.retained && st.retained.n, 0);
    return n === 0 ? now - st.masteredAt >= PROBE_FIRST_DAYS * DAY : now >= due;
  }).sort((a, b) => probeDueAt(subj.topicState[a.id]) - probeDueAt(subj.topicState[b.id]));
}
// Pick this sitting's items across subjects: at most two per topic, five in all, topics interleaved.
function pickProbe(perTopic, size = PROBE_SIZE) {
  const queues = perTopic.map((x) => ({ key: x.key, items: x.items.slice(0, PROBE_PER_TOPIC) })).filter((q) => q.items.length);
  const out = [];
  while (out.length < size && queues.some((q) => q.items.length)) for (const q of queues) { if (out.length >= size) break; if (q.items.length) out.push({ key: q.key, item: q.items.shift() }); }
  return out;
}
function recordProbe(subj, tid, ok, now = nowMs()) {
  const st = subj.topicState[tid] || (subj.topicState[tid] = {});
  const r = st.retained || { ok: 0, n: 0 };
  st.retained = { ok: r.ok + (ok ? 1 : 0), n: r.n + 1, at: now, last: ok ? 1 : 0 };
  const p = (subj.stats = subj.stats || {}).probe || { ok: 0, n: 0 };
  subj.stats.probe = { ok: p.ok + (ok ? 1 : 0), n: p.n + 1, at: now };
}
// Retention across a stage's probed topics, for "80% retained" beside "60% evidenced".
function stageRetention(subj, stageId) {
  let ok = 0, n = 0;
  for (const t of subj.plan.topics) { if (t.stage !== stageId) continue; const r = (subj.topicState[t.id] || {}).retained; if (r && r.n) { ok += r.ok; n += r.n; } }
  return { ok, n, rate: n ? ok / n : null };
}
// What the probes change. Rawson and Dunlosky (2011) found three correct recalls in the first
// sitting, then three spaced relearning sessions, the efficient recipe for durable learning: more
// initial recalls add little, more spaced relearning adds a lot. So poor delayed retention tightens
// the spacing, not the in-sitting bar: the review scheduler aims for a higher recall probability
// (reviews come sooner, so there are more relearning sessions before a memory lapses), and below
// 60% a topic also needs one more spaced recall before it counts as secure. The thresholds (60%,
// 75%) are provisional until the probes themselves say where the knee of the curve is.
function calibrateFromProbes(subj, now = nowMs()) {
  const p = (subj.stats || {}).probe;
  if (!p || p.n < CALIBRATE_AFTER) return null;
  const rate = p.ok / p.n;
  const cal = rate < 0.6 ? { retention: 0.95, relearn: 1 } : rate < 0.75 ? { retention: 0.93, relearn: 0 } : { retention: null, relearn: 0 };
  subj.stats.calibration = Object.assign(cal, { at: now, rate: Math.round(rate * 100) / 100, n: p.n });
  return subj.stats.calibration;
}
const relearnBump = (subj) => num(subj && subj.stats && subj.stats.calibration && subj.stats.calibration.relearn, 0);
const criterionFor = (subj) => num(subj && subj.stats && subj.stats.calibration && subj.stats.calibration.criterion, CRITERION);
const retentionFor = (subj, fallback) => { const c = subj && subj.stats && subj.stats.calibration; return c && c.retention ? c.retention : num(fallback, 0.9); };

// ---------- mixed practice across topics ----------
// Interleaving (Rohrer and Taylor 2007; Rohrer, Dedrick and Stershic 2015) works when practice keeps
// mixing earlier topics in, not as an occasional event. Each topic's own practice already mixes in two
// questions against earlier topics; this adds a set across several topics as soon as there are enough
// to confuse (four), and again after every three more are learned, so the mixing keeps pace with the
// learning. Two weeks without new topics also brings one round.
const MIXED_MIN_LEARNED = 4;
const MIXED_EVERY_LEARNED = 3;
const MIXED_MAX_DAYS = 14;
const MIXED_TOPICS = 5;
function mixedDue(subj, now = nowMs()) {
  const learned = subj.plan.topics.filter((t) => isLearned(subj, t));
  if (learned.length < MIXED_MIN_LEARNED) return null;
  const m = subj.stats && subj.stats.mixed;
  if (m && learned.length - num(m.learned, 0) < MIXED_EVERY_LEARNED && now - num(m.at, 0) < MIXED_MAX_DAYS * DAY) return null;
  // Two learned longest ago, two most recent, and the one whose ideas slip most in practice and reviews.
  const byAge = learned.slice().sort((a, b) => num((subj.topicState[a.id] || {}).masteredAt, 0) - num((subj.topicState[b.id] || {}).masteredAt, 0));
  const weak = weakConcepts(subj, 3).map((c) => c.tid);
  const pick = [];
  const add = (t) => { if (t && !pick.some((x) => x.id === t.id) && pick.length < MIXED_TOPICS) pick.push(t); };
  byAge.slice(0, 2).forEach(add);
  byAge.slice(-2).forEach(add);
  weak.forEach((tid) => add(learned.find((t) => t.id === tid)));
  byAge.slice(2, -2).reverse().forEach(add);
  return pick.length >= 3 ? pick : null;
}
function recordMixed(subj, results, now = nowMs()) {
  const m = (subj.stats = subj.stats || {}).mixed || { ok: 0, n: 0 };
  let ok = 0;
  for (const r of results) { if (r.ok) ok++; const st = subj.topicState[r.topicId]; if (st && !r.ok) st.misses = num(st.misses, 0) + 1; }
  subj.stats.mixed = { ok: m.ok + ok, n: m.n + results.length, at: now, learned: subj.plan.topics.filter((t) => isLearned(subj, t)).length };
}

// ---------- concept-level mastery ----------
// Each lesson names its 2 to 4 concepts; practice items and cards point at one. Mastery is tracked per concept, which is
// finer than per topic, and feeds the level checks and the learner profile.
const conceptKey = (tid, i) => tid + ':' + i;
function noteConcept(subj, tid, idx, name, ok) {
  if (idx == null || idx < 0) return;
  subj.concepts = subj.concepts || {};
  const k = conceptKey(tid, idx);
  const c = subj.concepts[k] || (subj.concepts[k] = { tid, name: str(name, 120), n: 0, ok: 0 });
  c.n++; if (ok) c.ok++; c.last = nowMs(); if (name) c.name = str(name, 120);
}
function weakConcepts(subj, limit) {
  return Object.values(subj.concepts || {}).filter((c) => c.n >= 2 && c.ok / c.n < 0.7).sort((a, b) => a.ok / a.n - b.ok / b.n).slice(0, limit || 6);
}
function lessonConceptName(lesson, idx) { return lesson && arr(lesson.concepts)[idx] ? lesson.concepts[idx] : ''; }

// ---------- roles ----------
// A role is a job the learner aspires to, mapped into areas of knowledge, skill and interpersonal ability, each with the
// level on the ladder needed to be good at it. Each area can become a subject; readiness compares the ladder with the need.
// `subjects` are the learner's subject contexts; an area linked to one earns credit from that subject's position.
function areaCredit(area, subjects) {
  if (area.have) return 1;
  const subj = area.subjectId ? arr(subjects).find((x) => x.id === area.subjectId) : null;
  if (!subj) return 0;
  const pos = stagePosition(subj);
  const need = stageIdx(area.level) + 1;
  const have = (pos.explicit + 1) + (pos.inPlan ? pos.pct : 0);
  return clampNum(have / need, 0, 1);
}
function roleReadiness(role, subjects) {
  const areas = arr(role.map && role.map.areas);
  if (!areas.length) return 0;
  return areas.reduce((n, a) => n + areaCredit(a, subjects), 0) / areas.length;
}
const roleForSubject = (roles, sid) => arr(roles).find((r) => arr(r.map && r.map.areas).some((a) => a.subjectId === sid)) || null;

export { reopenTopics, placeKnown, topicById, learnerAbout, learnerModel, subjectCards, topicStatus, isLearned, learnedCount, studiedCount, nextTopic, practisingTopics, currentMilestone, relearnCount, isSecure, secureCount, dueCards, stageTopics, stageProgress, firstPlannedIdx, stagePosition, isSkippedStage, daysUntil, positionText, levelCheckReady, coveredStage, dayAgo, minutesSince, checkEligible, checkMilestones, markStageReached, recordMinutes, logReview, retentionRate, paceStats, paceBasis, stageHours, remainingMinutes, estimateStage, fmtMonth, fmtWeeks, fmtWhen, fmtHours, estimateText, nextStageEstimate, activityDays, conceptKey, noteConcept, weakConcepts, lessonConceptName, areaCredit, roleReadiness, roleForSubject, probeDue, probeDueAt, probeCandidates, pickProbe, recordProbe, stageRetention, calibrateFromProbes, criterionFor, retentionFor, mixedDue, recordMixed, PROBE_MIN_ITEMS };
