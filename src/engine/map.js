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
import { STAGES, stageIdx, stageName } from './ladder.js';
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

// ---------- the graph by field ----------

// The same knowledge grouped by what each idea is rather than where it is taught: the learner
// at the centre, a node per field (Physics, Portuguese), a node per area within it (Electricity,
// Verbs), and every topic under its area, whichever subject teaches it. A topic the planner has
// not placed yet sits under its subject's title until the backfill places it. Edges: topic to
// area, area to field, field to the learner, plus the prerequisite and bridge links as before.
// Positions come from a force layout in the app (src/components/forceLayout.ts); this is the data.
/**
 * @param {{ subjects: any[]; know?: any[]; prior?: any[]; now?: number; retention?: number }} args
 * @returns {{ nodes: any[]; edges: { from: string; to: string; kind: string }[]; placed: boolean }}
 */
function fieldGraph({ subjects, know = [], prior = [], now = nowMs(), retention = 0.9 }) {
  const priorRows = arr(prior).filter((f) => f && str(f.field));
  // Once the learner's own fields are on the map as nodes, the small squares for CV items are
  // redundant; they stay in the by-subject view.
  const base = knowledgeGraph({ subjects, know: priorRows.length ? [] : know, now, retention });
  const nodes = base.nodes.filter((n) => n.kind !== 'subject');
  const edges = base.edges.filter((e) => e.kind !== 'root' && e.kind !== 'covers' && e.kind !== 'bridge' && !(e.kind === 'spoke' && e.from.startsWith('s:')));
  const subjectTitle = new Map(arr(subjects).map((s) => [s.id, str(s.plan && s.plan.title, 80)]));
  const fields = new Map();
  const areas = new Map();
  const slug = (x) => str(x, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // What the learner brought with them comes first on the ring, then fields and areas in the
  // order they first appeared (the oldest subject's first topic first), so a new subject adds
  // to the ring without moving the rest.
  priorRows.forEach((f, i) => {
    const field = str(f.field, 40);
    const area = str(f.area, 40);
    const fid = 'f:' + slug(field);
    const standing = { id: str(f.id), level: str(f.level, 4) || 's2', verifiedLevel: str(f.verified_level || f.verifiedLevel, 4) || null, basis: str(f.basis, 120), evidence: { ok: 0, n: 0 } };
    if (!fields.has(fid)) fields.set(fid, { id: fid, kind: 'field', label: field, topics: 0, learned: 0, secure: 0, recall: [], placed: true, order: -100000 + i });
    const fnode = fields.get(fid);
    if (area && area.toLowerCase() !== field.toLowerCase()) {
      const aid = 'a:' + slug(field) + '/' + slug(area);
      if (!areas.has(aid)) areas.set(aid, { id: aid, kind: 'area', label: area, field: fid, topics: 0, learned: 0, secure: 0, recall: [], order: -100000 + i });
      areas.get(aid).prior = standing;
      // The field itself stands at least as high as its highest area the learner brought.
      if (!fnode.prior || stageIdx(standing.verifiedLevel || standing.level) > stageIdx(fnode.prior.verifiedLevel || fnode.prior.level)) fnode.prior = { ...standing, fromArea: true };
    } else {
      fnode.prior = standing;
    }
  });
  const subjIdx = new Map(arr(subjects).map((s, i) => [s.id, i]));
  let seq = 0;
  for (const n of nodes) {
    if (n.kind !== 'topic') continue;
    const topic = arr(subjects).find((s) => s.id === n.subjectId);
    const t = topic ? arr(topic.plan.topics).find((x) => x.id === n.topicId) : null;
    const schema = t && arr(t.schema).length ? arr(t.schema) : [subjectTitle.get(n.subjectId) || 'Unsorted'];
    const field = str(schema[0], 40);
    const area = str(schema[1], 40) || field;
    const fid = 'f:' + slug(field);
    const aid = 'a:' + slug(field) + '/' + slug(area);
    const order = (subjIdx.get(n.subjectId) || 0) * 10000 + seq++;
    if (!fields.has(fid)) fields.set(fid, { id: fid, kind: 'field', label: field, topics: 0, learned: 0, secure: 0, recall: [], placed: !!(t && arr(t.schema).length), order });
    if (!areas.has(aid)) areas.set(aid, { id: aid, kind: 'area', label: area, field: fid, topics: 0, learned: 0, secure: 0, recall: [], order });
    const f = fields.get(fid); const a = areas.get(aid);
    f.topics++; a.topics++;
    if (n.status === 'learned' || n.status === 'secure') { f.learned++; a.learned++; if (typeof n.recall === 'number') { f.recall.push(n.recall); a.recall.push(n.recall); } }
    if (n.status === 'secure') { f.secure++; a.secure++; }
    n.area = aid; n.field = fid; n.subject = subjectTitle.get(n.subjectId) || '';
    edges.push({ from: n.id, to: aid, kind: 'in' });
  }
  // The links lessons drew to what the learner already knew, now to the field or area itself
  // (or, with no fields on the map yet, to the CV item). Each link also carries the warm-up's
  // "prior" question: a right answer is evidence the field is held, counted on the node.
  const candidates = [
    ...[...fields.values()].filter((f) => f.prior).map((f) => ({ id: f.id, title: f.label, detail: '' })),
    ...[...areas.values()].filter((a) => a.prior).map((a) => ({ id: a.id, title: fields.get(a.field).label + ' ' + a.label, detail: '' })),
    ...(priorRows.length ? [] : base.nodes.filter((n) => n.kind === 'know').map((n) => ({ id: n.id, title: n.label, detail: n.detail }))),
  ];
  for (const n of nodes) {
    if (n.kind !== 'topic') continue;
    const subj = arr(subjects).find((x) => x.id === n.subjectId);
    const st = subj && subj.topicState ? subj.topicState[n.topicId] || {} : {};
    const b = st.bridge;
    if (!b || typeof b !== 'object') continue;
    if (str(b.topic)) { const to = 't:' + n.subjectId + ':' + str(b.topic); if (nodes.some((x) => x.id === to) && to !== n.id) edges.push({ from: n.id, to, kind: 'bridge' }); continue; }
    if (!str(b.field)) continue;
    const hit = matchField(b.field, candidates);
    if (!hit) continue;
    edges.push({ from: n.id, to: hit.id, kind: 'bridge' });
    const target = fields.get(hit.id) || areas.get(hit.id);
    if (target && target.prior && typeof st.priorScore === 'number') { target.prior.evidence.n++; if (st.priorScore >= 0.75) target.prior.evidence.ok++; }
  }
  // How much of a field or area is held: learned counts half, secure the other half, so a hub
  // grows as topics are learned and again as they prove to stay learned. A hub the learner
  // brought with them grows with the level they stand at, a little less until a check shows it.
  const finish = (h) => {
    h.recall = meanOr(h.recall, null);
    const taught = h.topics ? (h.learned + h.secure) / (2 * h.topics) : 0;
    const brought = h.prior ? ((stageIdx(h.prior.verifiedLevel || h.prior.level) + 1) / STAGES.length) * (h.prior.verifiedLevel ? 1 : 0.7) : 0;
    h.mastery = Math.max(taught, brought);
  };
  for (const a of areas.values()) { finish(a); edges.push({ from: a.id, to: a.field, kind: 'in' }); }
  for (const f of fields.values()) { finish(f); edges.push({ from: f.id, to: 'you', kind: 'spoke' }); }
  // An area that is the whole of its field (no second level given) collapses into the field.
  const only = new Map();
  for (const a of areas.values()) only.set(a.field, (only.get(a.field) || 0) + 1);
  const collapse = new Set([...areas.values()].filter((a) => only.get(a.field) === 1 && a.label === fields.get(a.field).label).map((a) => a.id));
  const kept = [...areas.values()].filter((a) => !collapse.has(a.id));
  const outEdges = edges.filter((e) => !collapse.has(e.from)).map((e) => (collapse.has(e.to) ? { ...e, to: areas.get(e.to).field } : e));
  for (const n of nodes) if (n.kind === 'topic' && collapse.has(n.area)) n.area = n.field;
  const byOrder = (x, y) => x.order - y.order;
  return { nodes: [...nodes, ...[...fields.values()].sort(byOrder), ...kept.sort(byOrder)], edges: outEdges, placed: [...fields.values()].every((f) => f.placed) };
}

// ---------- the layout ----------

const R_KNOW = 72;       // the learner's own fields
const R_HUB = 190;       // subject hubs
const R_FIRST = 56;      // first ring of topics beyond its hub
const R_STEP = 44;       // each further level
const MIN_GAP = 12;      // least distance between neighbouring topics on a ring, in map units
const RADIUS = { you: 9, know: 4.5, subject: 11, field: 10, area: 6.5, topic: 4.5 };

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

// A hub grows with mastery: up to 1.8 times its base size when every topic under it is secure.
function nodeRadius(n) {
  const r = RADIUS[n.kind] || 4;
  if (n.kind === 'field' || n.kind === 'area') return r * (1 + 0.8 * (typeof n.mastery === 'number' ? n.mastery : 0));
  return n.kind === 'topic' && n.threshold ? r + 1.5 : r;
}

// One line about a node for the card under the map.
function nodeLine(n) {
  if (n.kind === 'you') return 'Everything on the map hangs off what you already knew.';
  if (n.kind === 'know') return 'Something you brought with you. Lessons draw comparisons from it.';
  if (n.kind === 'field' || n.kind === 'area') {
    const parts = [];
    if (n.prior) {
      const p = n.prior;
      parts.push(p.verifiedLevel ? `${stageName(p.verifiedLevel)}, shown in a check` : `${stageName(p.level)} as you described it${p.fromArea ? '' : ', not yet checked'}`);
      if (p.evidence && p.evidence.n) parts.push(`drawn on in ${p.evidence.n} ${p.evidence.n === 1 ? 'lesson' : 'lessons'}, right ${p.evidence.ok} ${p.evidence.ok === 1 ? 'time' : 'times'}`);
    }
    if (n.topics) parts.push(`${n.learned} of ${n.topics} topics learned`);
    if (n.secure) parts.push(`${n.secure} secure`);
    if (typeof n.recall === 'number') parts.push(`${Math.round(n.recall * 100)}% likely recalled now`);
    return parts.join(' · ') || 'Nothing here yet.';
  }
  if (n.kind === 'subject') {
    const parts = [`${n.learned} of ${n.total} topics learned`];
    if (n.secure) parts.push(`${n.secure} secure`);
    if (typeof n.recall === 'number') parts.push(`${Math.round(n.recall * 100)}% likely recalled now`);
    return parts.join(' · ');
  }
  const level = STAGES[n.stageIdx] ? STAGES[n.stageIdx].name : '';
  const status = n.status === 'secure' ? 'Secure' : n.status === 'learned' ? 'Learned' : n.status === 'learning' ? 'In progress' : n.status === 'practising' ? 'Practising' : n.status === 'available' ? 'Ready to start' : 'Later on the path';
  const parts = [status, level].filter(Boolean);
  if (n.subject) parts.push(n.subject);
  if (typeof n.recall === 'number') parts.push(`${Math.round(n.recall * 100)}% likely recalled now`);
  if (n.threshold) parts.push('key idea');
  return parts.join(' · ');
}

export { knowledgeGraph, fieldGraph, layoutGraph, nodeRadius, nodeLine, matchField, topicRecall, R_HUB, R_KNOW };
