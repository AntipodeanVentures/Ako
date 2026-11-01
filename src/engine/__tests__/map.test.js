import { describe, expect, it } from 'vitest';

import { DAY, knowledgeGraph, layoutGraph, makeCards, matchField, nodeLine, normalisePlan, R_HUB, R_KNOW } from '../index.js';
import { planPortuguese } from '../fixtures.js';

const intake = { subject: 'Brazilian Portuguese', current: 'Know a little', target: 's3', hours: 2, minutes: 15, why: 'travel' };
const T0 = Date.UTC(2026, 0, 10, 12);

function subject(id, title, opts = {}) {
  const plan = normalisePlan({ ...planPortuguese, title }, intake, 's2');
  const t0 = plan.topics[0];
  // A later topic whose prerequisites do not include the first, so its bridge back to it is a line of its own.
  const t1 = plan.topics.find((t) => t.id !== t0.id && !t.prereqs.includes(t0.id));
  const cards = makeCards(t0, [{ front: 'q1', back: 'a1' }, { front: 'q2', back: 'a2' }], 3, 0.9, T0 - 20 * DAY);
  return {
    id, plan, intake: { ...intake, elsewhere: opts.elsewhere || [] },
    topicState: {
      [t0.id]: { status: 'mastered', masteredAt: T0 - 20 * DAY, bridge: { field: 'airline flying' } },
      [t1.id]: { status: 'learning', attempts: 1, bridge: { topic: t0.id } },
    },
    stages: {}, concepts: {}, stats: {}, pitch: 2, support: 'full', learner: { about: '', model: null }, cards,
  };
}

const know = [
  { id: 'k1', kind: 'job', title: 'Airline captain', detail: '12 years' },
  { id: 'k2', kind: 'sport', title: 'Brazilian jiu-jitsu', detail: 'brown belt' },
];

describe('knowledge map', () => {
  it('has a node for the learner, each field, each subject and each topic, with status and recall', () => {
    const s = subject('s1', 'Brazilian Portuguese');
    const g = knowledgeGraph({ subjects: [s], know, now: T0 });
    expect(g.nodes.filter((n) => n.kind === 'you')).toHaveLength(1);
    expect(g.nodes.filter((n) => n.kind === 'know')).toHaveLength(2);
    expect(g.nodes.filter((n) => n.kind === 'subject')).toHaveLength(1);
    expect(g.nodes.filter((n) => n.kind === 'topic')).toHaveLength(s.plan.topics.length);
    const first = g.nodes.find((n) => n.kind === 'topic' && n.topicId === s.plan.topics[0].id);
    expect(first.status).toBe('learned');
    // Twenty days after a first review, the cards are well below certain recall and above zero.
    expect(first.recall).toBeGreaterThan(0.2);
    expect(first.recall).toBeLessThan(0.95);
    const second = g.nodes.find((n) => n.kind === 'topic' && n.status === 'learning');
    expect(second.status).toBe('learning');
    expect(second.recall).toBeNull();
    const hub = g.nodes.find((n) => n.kind === 'subject');
    expect(hub.learned).toBe(1);
    expect(hub.recall).toBeCloseTo(first.recall, 5);
  });

  it('draws prerequisites, the links lessons made, and the subjects planned on each other', () => {
    const a = subject('s1', 'Brazilian Portuguese');
    const b = subject('s2', 'Spanish', { elsewhere: [{ title: 'Brazilian Portuguese', topics: ['x'], learned: [] }] });
    const g = knowledgeGraph({ subjects: [a, b], know, now: T0 });
    const kinds = (k) => g.edges.filter((e) => e.kind === k);
    expect(kinds('prereq').length).toBeGreaterThan(0);
    // The learned topic's lesson named one of the learner's fields; the next one named the learned topic.
    expect(kinds('bridge').some((e) => e.to === 'k:k1' && e.from === 't:s1:' + a.plan.topics[0].id)).toBe(true);
    const learning = Object.keys(a.topicState).find((id) => a.topicState[id].status === 'learning');
    expect(kinds('bridge').some((e) => e.to === 't:s1:' + a.plan.topics[0].id && e.from === 't:s1:' + learning)).toBe(true);
    // A bridge that repeats a prerequisite is not drawn twice.
    const withPre = a.plan.topics.find((t) => t.prereqs.includes(a.plan.topics[0].id));
    a.topicState[withPre.id] = { status: 'mastered', masteredAt: T0, bridge: { topic: a.plan.topics[0].id } };
    const again = knowledgeGraph({ subjects: [a], know, now: T0 });
    expect(again.edges.filter((e) => e.from === 't:s1:' + withPre.id && e.to === 't:s1:' + a.plan.topics[0].id)).toHaveLength(1);
    expect(kinds('covers')).toEqual([{ from: 's:s2', to: 's:s1', kind: 'covers' }]);
    // Every subject and field hangs off the learner.
    expect(kinds('spoke')).toHaveLength(4);
    // Nothing points at a node that is not there.
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
  });

  it('matches a named field to a know item by its words, and not to a stranger', () => {
    const items = [{ id: 'k1', title: 'Airline captain', detail: '12 years' }, { id: 'k2', title: 'Structured finance', detail: '' }];
    expect(matchField('commercial airline flying', items)?.id).toBe('k1');
    expect(matchField('finance', items)?.id).toBe('k2');
    expect(matchField('gardening', items)).toBeNull();
    expect(matchField('', items)).toBeNull();
  });

  it('lays the map out the same way every time, with fields inside, hubs on a ring and topics beyond them', () => {
    const a = subject('s1', 'Brazilian Portuguese');
    const b = subject('s2', 'Spanish');
    const g = knowledgeGraph({ subjects: [a, b], know, now: T0 });
    const one = layoutGraph(g);
    const two = layoutGraph(g);
    expect(two).toEqual(one);
    const { positions, extent } = one;
    expect(positions.you).toEqual({ x: 0, y: 0 });
    for (const n of g.nodes) {
      expect(positions[n.id]).toBeDefined();
      const r = Math.hypot(positions[n.id].x, positions[n.id].y);
      if (n.kind === 'know') expect(r).toBeGreaterThanOrEqual(R_KNOW - 1);
      if (n.kind === 'subject') expect(r).toBeCloseTo(R_HUB, 0);
      if (n.kind === 'topic') expect(r).toBeGreaterThan(R_HUB + 30);
      expect(r).toBeLessThanOrEqual(extent);
    }
    // No two topics of one subject sit on top of each other.
    const topics = g.nodes.filter((n) => n.kind === 'topic');
    for (let i = 0; i < topics.length; i++) for (let j = i + 1; j < topics.length; j++) {
      const p = positions[topics[i].id]; const q = positions[topics[j].id];
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(8);
    }
  });

  it('says one plain line about a node', () => {
    const s = subject('s1', 'Brazilian Portuguese');
    const g = knowledgeGraph({ subjects: [s], know, now: T0 });
    const first = g.nodes.find((n) => n.kind === 'topic' && n.topicId === s.plan.topics[0].id);
    expect(nodeLine(first)).toMatch(/^Learned · Beginner · \d+% likely recalled now/);
    expect(nodeLine(g.nodes.find((n) => n.kind === 'subject'))).toMatch(/^1 of \d+ topics learned/);
    expect(nodeLine(g.nodes.find((n) => n.kind === 'know'))).toMatch(/brought with you/);
  });
});

describe('knowledge map at the size of a real learner', () => {
  it('keeps six subjects of twenty topics apart', () => {
    const subjects = Array.from({ length: 6 }, (_, i) => {
      const topics = [];
      for (let j = 0; j < 20; j++) topics.push({ id: 't' + j, title: 'Topic ' + j, summary: '', kind: 'concept', stage: 's1', outcome: 0, threshold: j % 7 === 0, milestone: 'm1', prereqs: j ? ['t' + (j - 1)] : [], minutes: 30 });
      for (let j = 20; j < 35; j++) topics.push({ id: 't' + j, title: 'Topic ' + j, summary: '', kind: 'concept', stage: 's2', outcome: 0, threshold: false, milestone: 'm2', prereqs: ['t' + (j - 1)], minutes: 30 });
      return { id: 'S' + i, plan: { title: 'Subject ' + i, topics, stages: [], milestones: [] }, intake: {}, topicState: {}, stages: {}, concepts: {}, stats: {}, cards: [] };
    });
    const g = knowledgeGraph({ subjects, know: Array.from({ length: 14 }, (_, i) => ({ id: 'k' + i, kind: 'job', title: 'Field ' + i })), now: T0 });
    const { positions, extent } = layoutGraph(g);
    const all = g.nodes.map((n) => ({ n, p: positions[n.id] }));
    let closest = Infinity;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const d = Math.hypot(all[i].p.x - all[j].p.x, all[i].p.y - all[j].p.y);
      if (d < closest) closest = d;
    }
    expect(closest).toBeGreaterThan(7);
    expect(extent).toBeLessThan(420);
  });
});
