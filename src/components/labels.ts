// Labels on the map are placed one at a time, most important first, each trying a few spots
// round its node (below, above, right, left) and taking the first that does not land on a node
// or on a label already placed. A label that must show (a field, the tapped node) takes the
// least crowded spot when every spot is taken; any other waits for a pinch.

export type Side = 'below' | 'above' | 'right' | 'left';
export type LabelItem = {
  id: string;
  text: string;
  // The node's centre and the radius to clear.
  x: number;
  y: number;
  r: number;
  // The text box: w for the halo, h its height; the baseline sits 4 points above the box's bottom.
  w: number;
  h: number;
  prefer: Side[];
  must: boolean;
};
export type Placed = { id: string; text: string; x: number; y: number; w: number; h: number; anchor: 'middle' | 'start' | 'end' };
export type Obstacle = { id: string; x1: number; y1: number; x2: number; y2: number };
type Rect = { x1: number; y1: number; x2: number; y2: number };

const PAD = 2;
const GAP = 4;

function spot(it: LabelItem, side: Side): { x: number; y: number; anchor: Placed['anchor'] } {
  if (side === 'below') return { x: it.x, y: it.y + it.r + GAP + it.h - 4, anchor: 'middle' };
  if (side === 'above') return { x: it.x, y: it.y - it.r - GAP - 2, anchor: 'middle' };
  if (side === 'right') return { x: it.x + it.r + GAP, y: it.y + it.h / 3, anchor: 'start' };
  return { x: it.x - it.r - GAP, y: it.y + it.h / 3, anchor: 'end' };
}

function box(p: { x: number; y: number; anchor: Placed['anchor'] }, w: number, h: number): Rect {
  const x1 = p.anchor === 'middle' ? p.x - w / 2 : p.anchor === 'start' ? p.x : p.x - w;
  return { x1, y1: p.y - h + 4, x2: x1 + w, y2: p.y + 4 };
}

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) + PAD) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) + PAD);

export function placeLabels(items: LabelItem[], obstacles: Obstacle[], bounds?: Rect): Map<string, Placed> {
  const placed = new Map<string, Placed>();
  const taken: Rect[] = [];
  for (const it of items) {
    let best: { p: ReturnType<typeof spot>; cost: number } | null = null;
    for (const side of it.prefer) {
      const p = spot(it, side);
      const b = box(p, it.w, it.h);
      let cost = 0;
      // Off the edge of the box counts as a collision, so a label never hangs outside the map.
      if (bounds && (b.x1 < bounds.x1 || b.x2 > bounds.x2 || b.y1 < bounds.y1 || b.y2 > bounds.y2)) cost += 1e6;
      for (const t of taken) cost += overlap(b, t);
      for (const o of obstacles) if (o.id !== it.id) cost += overlap(b, o);
      if (cost === 0) { best = { p, cost }; break; }
      if (!best || cost < best.cost) best = { p, cost };
    }
    if (!best) continue;
    if (best.cost > 0 && !it.must) continue;
    const b = box(best.p, it.w, it.h);
    taken.push(b);
    placed.set(it.id, { id: it.id, text: it.text, x: best.p.x, y: best.p.y, w: it.w, h: it.h, anchor: best.p.anchor });
  }
  return placed;
}
