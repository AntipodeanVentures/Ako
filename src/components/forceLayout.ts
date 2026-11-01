import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';

import { nodeRadius } from '@/src/engine/map';

// The by-field map settles into place with a force simulation: fields repel each other and sit
// on a ring around the learner, areas cluster round their field, topics round their area, and
// the prerequisite and bridge links tug gently so related ideas end up near each other. The
// simulation is seeded from a radial guess so it converges in a second or two and the same data
// settles the same way (d3-force's random source is seeded).

type GraphNode = { id: string; kind: string; field?: string; area?: string; label: string };
type GraphEdge = { from: string; to: string; kind: string };
type Sim = SimulationNodeDatum & { id: string; kind: string; r: number };

export type ForceLayout = {
  // One step; returns the current positions and whether the simulation has settled.
  tick: (steps?: number) => { positions: Record<string, { x: number; y: number }>; settled: boolean; extent: number };
  stop: () => void;
};

const R_FIELD = 150;

// A small seeded generator, so the starting guess (and so the settled map) is the same each time.
function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

export function forceLayout(graph: { nodes: GraphNode[]; edges: GraphEdge[] }): ForceLayout {
  const rand = seeded(graph.nodes.map((n) => n.id).join('|'));
  const fields = graph.nodes.filter((n) => n.kind === 'field');
  const fieldAngle = new Map<string, number>();
  fields.forEach((f, i) => fieldAngle.set(f.id, -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, fields.length)));
  const knowIds = graph.nodes.filter((n) => n.kind === 'know').map((n) => n.id);
  const knowIndex = new Map(knowIds.map((id, i) => [id, i]));
  const knowCount = knowIds.length;
  const areaIndex = new Map<string, number>();
  const areaCount = new Map<string, number>();
  for (const n of graph.nodes) if (n.kind === 'area' && n.field) { areaIndex.set(n.id, areaCount.get(n.field) ?? 0); areaCount.set(n.field, (areaCount.get(n.field) ?? 0) + 1); }

  // A starting guess: fields on a ring, areas just outside their field, topics just outside their area.
  const seed = (n: GraphNode): { x: number; y: number } => {
    if (n.kind === 'you') return { x: 0, y: 0 };
    if (n.kind === 'know') { const i = knowIndex.get(n.id) ?? 0; const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, knowCount); return { x: 52 * Math.cos(a), y: 52 * Math.sin(a) }; }
    if (n.kind === 'field') { const a = fieldAngle.get(n.id) ?? 0; return { x: R_FIELD * Math.cos(a), y: R_FIELD * Math.sin(a) }; }
    if (n.kind === 'area') {
      const a = fieldAngle.get(n.field ?? '') ?? 0;
      const k = areaIndex.get(n.id) ?? 0;
      const spread = (k - ((areaCount.get(n.field ?? '') ?? 1) - 1) / 2) * 0.35;
      return { x: (R_FIELD + 55) * Math.cos(a + spread), y: (R_FIELD + 55) * Math.sin(a + spread) };
    }
    const a = fieldAngle.get(n.field ?? '') ?? 0;
    const jitter = () => (rand() - 0.5) * 30;
    return { x: (R_FIELD + 95) * Math.cos(a) + jitter(), y: (R_FIELD + 95) * Math.sin(a) + jitter() };
  };

  const nodes: Sim[] = graph.nodes.map((n) => ({ id: n.id, kind: n.kind, r: nodeRadius(n), ...seed(n) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: (SimulationLinkDatum<Sim> & { kind: string })[] = graph.edges
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  const distance = (l: { kind: string; source: Sim | string | number; target: Sim | string | number }) => {
    const t = typeof l.target === 'object' ? l.target.kind : '';
    if (l.kind === 'in') return t === 'field' ? 42 : 22;
    if (l.kind === 'spoke') return t === 'you' && (typeof l.source === 'object' ? l.source.kind : '') === 'field' ? R_FIELD : 45;
    return 60;
  };
  const strength = (l: { kind: string }) => (l.kind === 'in' ? 0.9 : l.kind === 'spoke' ? 0.5 : l.kind === 'prereq' ? 0.08 : 0.05);

  // The learner and the fields they brought with them hold still: everything else arranges itself around them.
  const you = byId.get('you');
  if (you) { you.fx = 0; you.fy = 0; }
  for (const n of nodes) if (n.kind === 'know') { n.fx = n.x; n.fy = n.y; }

  const sim = forceSimulation<Sim>(nodes)
    .force('link', forceLink<Sim, SimulationLinkDatum<Sim> & { kind: string }>(links).id((d) => d.id).distance(distance).strength(strength))
    .force('charge', forceManyBody<Sim>().strength((d) => (d.kind === 'field' ? -260 : d.kind === 'area' ? -70 : d.kind === 'you' ? -200 : d.kind === 'know' ? -40 : -14)).distanceMax(260))
    .force('collide', forceCollide<Sim>().radius((d) => d.r + (d.kind === 'field' ? 14 : d.kind === 'area' ? 8 : 3)).strength(0.9))
    .force('ring', forceRadial<Sim>(R_FIELD, 0, 0).strength((d) => (d.kind === 'field' ? 0.35 : d.kind === 'know' ? 0.0 : 0)))
    .force('knowRing', forceRadial<Sim>(52, 0, 0).strength((d) => (d.kind === 'know' ? 1 : 0)))
    .force('x', forceX<Sim>(0).strength(0.015))
    .force('y', forceY<Sim>(0).strength(0.015))
    .alpha(1)
    .alphaDecay(0.035)
    .stop();

  const snapshot = () => {
    const positions: Record<string, { x: number; y: number }> = {};
    let extent = 60;
    for (const n of nodes) {
      positions[n.id] = { x: n.x ?? 0, y: n.y ?? 0 };
      extent = Math.max(extent, Math.hypot(n.x ?? 0, n.y ?? 0) + 18);
    }
    return { positions, settled: sim.alpha() < sim.alphaMin(), extent: Math.ceil(extent) };
  };

  return {
    tick: (steps = 1) => { for (let i = 0; i < steps && sim.alpha() >= sim.alphaMin(); i++) sim.tick(); return snapshot(); },
    stop: () => sim.stop(),
  };
}
