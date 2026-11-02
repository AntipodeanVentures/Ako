import { describe, expect, it } from 'vitest';

import { DAY, fieldGraph, knowledgeGraph, layoutGraph, makeCards, matchField, nodeLine, nodeRadius, normalisePlan, R_HUB, R_KNOW } from '../index.js';
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

describe('knowledge map by field', () => {
  it('groups topics by field and area across subjects, and falls back to the subject title', () => {
    const a = subject('s1', 'Brazilian Portuguese');
    const b = subject('s2', 'Spanish');
    a.plan.topics[0].schema = ['Physics', 'Electricity'];
    a.plan.topics[1].schema = ['Physics', 'Electricity'];
    b.plan.topics[0].schema = ['Physics', 'Energy storage'];
    b.plan.topics[1].schema = ['Portuguese'];
    const g = fieldGraph({ subjects: [a, b], know, now: T0 });
    const fields = g.nodes.filter((n) => n.kind === 'field').map((n) => n.label).sort();
    expect(fields).toEqual(['Brazilian Portuguese', 'Physics', 'Portuguese', 'Spanish']);
    const areas = g.nodes.filter((n) => n.kind === 'area').map((n) => n.label).sort();
    // Electricity holds a topic from each of two subjects; a field with one unnamed area has no area node.
    expect(areas).toEqual(['Electricity', 'Energy storage']);
    const elec = g.nodes.find((n) => n.kind === 'area' && n.label === 'Electricity');
    expect(g.edges.filter((e) => e.kind === 'in' && e.to === elec.id)).toHaveLength(2);
    expect(g.nodes.some((n) => n.kind === 'subject')).toBe(false);
    expect(g.placed).toBe(false);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
    const t = g.nodes.find((n) => n.kind === 'topic' && n.topicId === a.plan.topics[0].id);
    expect(nodeLine(t)).toContain('Brazilian Portuguese');
  });
});

describe('knowledge map proficiency', () => {
  it('grows a hub with what is held under it and keeps fields in order of first appearance', () => {
    const a = subject('s1', 'Brazilian Portuguese');
    const b = subject('s2', 'Spanish');
    a.plan.topics.forEach((t) => { t.schema = ['Portuguese', 'Verbs']; });
    b.plan.topics.forEach((t) => { t.schema = ['Spanish', 'Verbs']; });
    // Every topic of the second subject learned and secure.
    for (const t of b.plan.topics) b.topicState[t.id] = { status: 'mastered', masteredAt: T0 - 30 * DAY, relearnDays: ['a', 'b', 'c'] };
    const g = fieldGraph({ subjects: [a, b], know, now: T0 });
    const fields = g.nodes.filter((n) => n.kind === 'field');
    expect(fields.map((n) => n.label)).toEqual(['Portuguese', 'Spanish']);
    const pt = fields[0]; const es = fields[1];
    expect(pt.mastery).toBeGreaterThan(0);
    expect(pt.mastery).toBeLessThan(0.5);
    expect(es.learned).toBe(b.plan.topics.length);
    expect(es.mastery).toBeGreaterThan(pt.mastery);
    expect(nodeRadius(es)).toBeGreaterThan(nodeRadius(pt));
    // The order survives the subjects arriving the other way round only for the one that is older.
    const g2 = fieldGraph({ subjects: [b, a], know, now: T0 });
    expect(g2.nodes.filter((n) => n.kind === 'field').map((n) => n.label)).toEqual(['Spanish', 'Portuguese']);
  });
});

describe('verifying a field the learner brought with them', () => {
  it('finds the highest rung passed with every rung below it passed', async () => {
    const { verifiedLevel } = await import('../index.js');
    const qs = [{ level: 's1' }, { level: 's1' }, { level: 's2' }, { level: 's2' }, { level: 's3' }, { level: 's3' }, { level: 's4' }, { level: 's4' }];
    const g = (scores) => scores.map((score) => ({ score }));
    expect(verifiedLevel(qs, g([1, 1, 1, 0.5, 1, 1, 0, 1])).level).toBe('s3');
    expect(verifiedLevel(qs, g([1, 1, 0, 0.5, 1, 1, 1, 1])).level).toBe('s1');
    expect(verifiedLevel(qs, g([0, 1, 1, 1, 1, 1, 1, 1])).level).toBeNull();
    expect(verifiedLevel(qs, g([1, 1, 1, 1, 1, 1, 1, 1])).level).toBe('s4');
    const r = verifiedLevel(qs, g([1, 1, 1, 0.5, 1, 1, 0, 1]));
    expect(r.score).toBe(6.5);
    expect(r.asked).toBe(8);
    expect(r.byLevel.s2).toEqual({ ok: 1.5, n: 2 });
  });
});

describe('knowledge map with what the learner brought', () => {
  it('puts prior fields on the ring first, links lessons to them and counts warm-up evidence', () => {
    const a = subject('s1', 'Multirotor flight physics');
    a.plan.topics.forEach((t) => { t.schema = ['Physics', 'Forces']; });
    // The first topic's lesson drew on the learner's flying; its warm-up prior question was right.
    a.topicState[a.plan.topics[0].id].bridge = { field: 'aviation flying' };
    a.topicState[a.plan.topics[0].id].priorScore = 1;
    const prior = [
      { id: 'p1', field: 'Aviation', area: 'Navigation', level: 's3', basis: 'CPL', verified_level: null },
      { id: 'p2', field: 'Aviation', area: 'Aircraft performance', level: 's3', basis: 'CPL', verified_level: 's4' },
      { id: 'p3', field: 'Finance', area: '', level: 's4', basis: '10 years', verified_level: null },
    ];
    const g = fieldGraph({ subjects: [a], know, prior, now: T0 });
    const fields = g.nodes.filter((n) => n.kind === 'field').map((n) => n.label);
    expect(fields).toEqual(['Aviation', 'Finance', 'Physics']);
    // No CV squares once the learner's fields are nodes.
    expect(g.nodes.some((n) => n.kind === 'know')).toBe(false);
    const aviation = g.nodes.find((n) => n.kind === 'field' && n.label === 'Aviation');
    // The field stands at its highest area: Aircraft performance, shown at Advanced.
    expect(aviation.prior.verifiedLevel).toBe('s4');
    expect(aviation.mastery).toBeCloseTo(0.8, 5);
    const finance = g.nodes.find((n) => n.kind === 'field' && n.label === 'Finance');
    expect(finance.prior.level).toBe('s4');
    expect(finance.mastery).toBeCloseTo(0.8 * 0.7, 5);
    expect(nodeRadius(finance)).toBeLessThan(nodeRadius(aviation));
    // The bridge lands on the Aviation field and the warm-up counts as evidence for it.
    const bridge = g.edges.find((e) => e.kind === 'bridge');
    expect(bridge.to).toBe(aviation.id);
    expect(aviation.prior.evidence).toEqual({ ok: 1, n: 1 });
    expect(nodeLine(aviation)).toMatch(/Advanced, shown in a check · drawn on in 1 lesson, right 1 time/);
    expect(nodeLine(finance)).toMatch(/Advanced as you described it, not yet checked/);
  });
});
