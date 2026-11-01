// The map of what the learner knows. Nodes are the learner, the fields they brought with them
// (the confirmed know items), each subject, and each planned topic; edges are the prerequisites
// inside a subject, the links lessons drew to earlier topics or to one of the learner's own
// fields, and the subjects that were planned knowing another already covered their basics.
//
// Every topic carries the state the engine already tracks: its status, and how likely its cards
// are to be recalled right now (the scheduler's retrievability, averaged over the topic's cards),
// so the map fades where memory is fading and brightens after a review.
//
// The layout is deterministic: the learner at the centre, their own fields on a ring around
// them, each subject a hub on an outer ring with the sector it is given sized to its topics,
// and the topics fanning outwards from the hub by level. The same data draws the same map.

import { arr, nowMs, str } from './core.js';
import { STAGES, stageIdx } from './ladder.js';
import { isSecure, topicStatus } from './progress.js';
import { recallChance } from './scheduling.js';

const TAU = Math.PI * 2;

// ---------- the graph ----------

// Words that mean nothing on their own when matching a lesson's "field" to a know item.
const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'and', 'or', 'for', 'to', 'at', 'on', 'with', 'as', 'my', 'your', 'their', 'own', 'work', 'years', 'year', 'experience', 'background']);
const words = (s) => str(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

// Which know item a lesson's bridge named, by shared words; null when none is close enough.
function matchField(field, know) {
  const fw = new Set(words(field));
  if (!fw.size) return null;
  let best = null;
  let bestScore = 0;
  for (const k of know) {
    const kw = words(k.title + ' ' + (k.detail || ''));
    const hit = kw.filter((w) => fw.has(w)).length;
    const score = hit / Math.max(1, Math.min(fw.size, kw.length));
    if (hit && score > bestScore) { best = k; bestScore = score; }
  }
  return bestScore >= 0.5 ? best : null;
}

const meanOr = (xs, d) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : d; };

// The learner's chance of recalling a topic right now: the mean over its cards, or null with no cards.
function topicRecall(subj, t, now, retention) {
  const cards = arr(subj.cards).filter((c) => c.topicId === t.id && !c.suspended);
  if (!cards.length) return null;
  return meanOr(cards.map((c) => recallChance(c, now, retention)), null);
}

// The map's own status words. The engine's 'mastered' and 'known' are both learned here; 'locked'
// means later on the path, not barred.
function mapStatus(subj, t) {
  const s = topicStatus(subj, t);
  if (s === 'mastered' || s === 'known') return isSecure(subj, t) ? 'secure' : 'learned';
  if (s === 'locked') return 'later';
  return s; // available, learning, practising
}

/**
 * @param {{ subjects: any[]; know?: any[]; now?: number; retention?: number }} args
 * @returns {{ nodes: any[]; edges: { from: string; to: string; kind: string }[] }}
 */
function knowledgeGraph({ subjects, know = [], now = nowMs(), retention = 0.9 }) {
  const nodes = [{ id: 'you', kind: 'you', label: 'You' }];
  const edges = [];
  const knowNodes = arr(know).filter((k) => k && str(k.title)).map((k) => ({
    id: 'k:' + str(k.id || k.title), kind: 'know', label: str(k.title, 80), detail: str(k.detail, 80), group: str(k.kind, 24), sourceId: k.id,
  }));
  nodes.push(...knowNodes);
  const titles = new Map();
  for (const subj of arr(subjects)) titles.set(str(subj.plan && subj.plan.title).toLowerCase(), 's:' + subj.id);

  for (const subj of arr(subjects)) {
    const sid = 's:' + subj.id;
    const topics = arr(subj.plan && subj.plan.topics);
    const ids = new Set(topics.map((t) => t.id));
    const tnode = (tid) => 't:' + subj.id + ':' + tid;
    const topicNodes = topics.map((t) => {
      const status = mapStatus(subj, t);
      return {
        id: tnode(t.id), kind: 'topic', label: str(t.title, 120), subjectId: subj.id, topicId: t.id,
        stage: t.stage, stageIdx: stageIdx(t.stage), status, threshold: !!t.threshold, kindOfTopic: str(t.kind, 16),
        recall: status === 'learned' || status === 'secure' || status === 'practising' ? topicRecall(subj, t, now, retention) : null,
      };
    });
    const learned = topicNodes.filter((n) => n.status === 'learned' || n.status === 'secure');
    nodes.push({
      id: sid, kind: 'subject', label: str(subj.plan && subj.plan.title, 80), subjectId: subj.id,
      total: topicNodes.length, learned: learned.length, secure: topicNodes.filter((n) => n.status === 'secure').length,
      recall: learned.length ? meanOr(learned.map((n) => n.recall), null) : null,
    });
    nodes.push(...topicNodes);
    for (const t of topics) {
      const pre = arr(t.prereqs).filter((p) => ids.has(p) && p !== t.id);
      for (const p of pre) edges.push({ from: tnode(t.id), to: tnode(p), kind: 'prereq' });
      // A topic with no prerequisite on the path hangs off the subject itself.
      if (!pre.length) edges.push({ from: tnode(t.id), to: sid, kind: 'root' });
      const b = (subj.topicState && subj.topicState[t.id] && subj.topicState[t.id].bridge) || null;
      if (b && typeof b === 'object') {
        if (str(b.topic) && ids.has(str(b.topic)) && str(b.topic) !== t.id && !pre.includes(str(b.topic))) edges.push({ from: tnode(t.id), to: tnode(str(b.topic)), kind: 'bridge' });
        else if (str(b.field)) { const k = matchField(b.field, knowNodes.map((n) => ({ id: n.id, title: n.label, detail: n.detail }))); if (k) edges.push({ from: tnode(t.id), to: k.id, kind: 'bridge' }); }
      }
    }
    // Planned knowing another subject already covered its basics.
    for (const other of arr(subj.intake && subj.intake.elsewhere)) {
      const oid = titles.get(str(other && other.title).toLowerCase());
      if (oid && oid !== sid && !edges.some((e) => e.kind === 'covers' && ((e.from === sid && e.to === oid) || (e.from === oid && e.to === sid)))) edges.push({ from: sid, to: oid, kind: 'covers' });
    }
  }
  // Every subject hangs off the learner; so does every field they brought.
  for (const n of nodes) if (n.kind === 'subject' || n.kind === 'know') edges.push({ from: n.id, to: 'you', kind: 'spoke' });
  return { nodes, edges };
}

// ---------- the layout ----------

const R_KNOW = 72;       // the learner's own fields
const R_HUB = 190;       // subject hubs
const R_FIRST = 56;      // first ring of topics beyond its hub
const R_STEP = 44;       // each further level
const MIN_GAP = 12;      // least distance between neighbouring topics on a ring, in map units
const RADIUS = { you: 9, know: 4.5, subject: 11, topic: 4.5 };

const polar = (r, a) => ({ x: Math.round(r * Math.cos(a) * 10) / 10, y: Math.round(r * Math.sin(a) * 10) / 10 });

// Places every node; returns positions by id and the map's extent. Angles start at the top and run
// clockwise, so the first subject sits at twelve o'clock.
/**
 * @param {{ nodes: any[]; edges: any[] }} graph
 * @returns {{ positions: Record<string, { x: number; y: number }>; extent: number }}
 */
function layoutGraph(graph) {
  const pos = { you: { x: 0, y: 0 } };
  const know = graph.nodes.filter((n) => n.kind === 'know');
  const subjects = graph.nodes.filter((n) => n.kind === 'subject');
  const topics = graph.nodes.filter((n) => n.kind === 'topic');
  const start = -Math.PI / 2;

  // Fields on one ring, or two staggered rings when there are many, grouped by kind so jobs sit together.
  const sortedKnow = [...know].sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  sortedKnow.forEach((n, i) => {
    const a = start + (TAU * i) / Math.max(1, sortedKnow.length);
    const r = sortedKnow.length > 10 && i % 2 ? R_KNOW + 22 : R_KNOW;
    pos[n.id] = polar(r, a);
  });

  // Each subject gets a sector in proportion to its widest level, so a subject with twenty
  // Beginner topics is not squeezed beside one with six.
  const weights = subjects.map((s) => {
    const mine = topics.filter((t) => t.subjectId === s.subjectId);
    const perStage = {};
    for (const t of mine) perStage[t.stage] = (perStage[t.stage] || 0) + 1;
    return Math.max(6, ...Object.values(perStage)) + 3;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let a0 = start;
  subjects.forEach((s, i) => {
    const span = (TAU * weights[i]) / total;
    const mid = a0 + span / 2;
    pos[s.id] = polar(R_HUB, mid);
    const mine = topics.filter((t) => t.subjectId === s.subjectId);
    // Levels present in this subject, nearest the hub first; topics keep their plan order along the arc.
    const stages = [...new Set(mine.map((t) => t.stage))].sort((x, y) => stageIdx(x) - stageIdx(y));
    stages.forEach((stage, rank) => {
      const ring = mine.filter((t) => t.stage === stage);
      const r = R_HUB + R_FIRST + rank * R_STEP;
      // The usable arc leaves a margin at each sector edge so neighbouring subjects do not touch.
      const margin = Math.min(span * 0.12, 18 / r);
      const arc = span - margin * 2;
      // When the ring cannot hold them MIN_GAP apart, alternate between the ring and one just outside it.
      const fits = ring.length <= 1 || (arc * r) / (ring.length - 1) >= MIN_GAP;
      ring.forEach((t, j) => {
        const f = ring.length === 1 ? 0.5 : j / (ring.length - 1);
        const ang = a0 + margin + arc * f;
        const rr = fits || j % 2 === 0 ? r : r + R_STEP * 0.42;
        pos[t.id] = polar(rr, ang);
      });
    });
    a0 += span;
  });

  let maxR = R_KNOW + 30;
  for (const id of Object.keys(pos)) maxR = Math.max(maxR, Math.hypot(pos[id].x, pos[id].y) + 16);
  return { positions: pos, extent: Math.ceil(maxR) };
}

function nodeRadius(n) {
  const r = RADIUS[n.kind] || 4;
  return n.kind === 'topic' && n.threshold ? r + 1.5 : r;
}

// One line about a node for the card under the map.
function nodeLine(n) {
  if (n.kind === 'you') return 'Everything on the map hangs off what you already knew.';
  if (n.kind === 'know') return 'Something you brought with you. Lessons draw comparisons from it.';
  if (n.kind === 'subject') {
    const parts = [`${n.learned} of ${n.total} topics learned`];
    if (n.secure) parts.push(`${n.secure} secure`);
    if (typeof n.recall === 'number') parts.push(`${Math.round(n.recall * 100)}% likely recalled now`);
    return parts.join(' · ');
  }
  const level = STAGES[n.stageIdx] ? STAGES[n.stageIdx].name : '';
  const status = n.status === 'secure' ? 'Secure' : n.status === 'learned' ? 'Learned' : n.status === 'learning' ? 'In progress' : n.status === 'practising' ? 'Practising' : n.status === 'available' ? 'Ready to start' : 'Later on the path';
  const parts = [status, level].filter(Boolean);
  if (typeof n.recall === 'number') parts.push(`${Math.round(n.recall * 100)}% likely recalled now`);
  if (n.threshold) parts.push('key idea');
  return parts.join(' · ');
}

export { knowledgeGraph, layoutGraph, nodeRadius, nodeLine, matchField, topicRecall, R_HUB, R_KNOW };
