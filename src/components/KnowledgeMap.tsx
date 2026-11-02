import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Button, Segmented, Text } from '@/src/components/ui';
import { STAGES } from '@/src/engine/ladder';
import { fieldGraph, knowledgeGraph, layoutGraph, nodeLine, nodeRadius, R_HUB } from '@/src/engine/map';
import type { LiveSubject } from '@/src/features/subjects';
import { useReducedMotion, useTheme } from '@/src/theme';

import { forceLayout } from './forceLayout';

type KnowItem = { id: string; kind: string; title: string; detail?: string };
// The engine is plain JavaScript; these are the fields the drawing reads.
type Node = {
  id: string; kind: 'you' | 'know' | 'subject' | 'field' | 'area' | 'topic'; label: string;
  subjectId?: string; topicId?: string; status?: string; recall?: number | null; threshold?: boolean; stageIdx?: number;
  total?: number; learned?: number; secure?: number; topics?: number; mastery?: number; field?: string; area?: string; subject?: string;
  // A field or area the learner brought with them: the level claimed, the level a check showed.
  prior?: { id: string; level: string; verifiedLevel: string | null; basis: string; evidence: { ok: number; n: number }; fromArea?: boolean };
};
type Edge = { from: string; to: string; kind: string };
type Graph = { nodes: Node[]; edges: Edge[]; placed?: boolean };
type Layout = { positions: Record<string, { x: number; y: number }>; extent: number };
type Mode = 'field' | 'subject';

type PriorField = { id: string; field: string; area: string; level: string; basis: string; verified_level: string | null };

type Props = {
  subjects: LiveSubject[];
  know: KnowItem[];
  // The fields the learner brought with them (prior_fields rows).
  prior?: PriorField[];
  retention?: number;
  // Places topics the planner has not yet put under a field and an area; run once when the map
  // finds any. Absent in the dev preview.
  onPlace?: () => Promise<void>;
  // The dev preview renders without navigation.
  onOpen?: (node: Node) => void;
};

const MIN_K = 0.5;
const MAX_K = 6;
const MODES: { value: Mode; label: string }[] = [
  { value: 'field', label: 'By field' },
  { value: 'subject', label: 'By subject' },
];

// The map of what the learner knows. By field: the learner at the centre, the fields they
// brought with them around that, then every idea grouped by what it is (Physics › Electricity),
// whichever subject teaches it, settling into place with a force layout. By subject: each
// subject a hub with its topics fanning out by level. A topic's fill is its status and its
// brightness is how likely it is to be recalled right now, so the map fades where memory is
// fading. Pan with a drag, zoom with a pinch or the buttons, tap a node for its line and a way
// to open it.
export function KnowledgeMap({ subjects, know, prior = [], retention = 0.9, onPlace, onOpen }: Props) {
  const { colors, spacing, radius: rad, typography } = useTheme();
  const reduced = useReducedMotion();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('field');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  // Where the view was when a drag or pinch began; a ref, so the gesture reads the value it started from.
  const viewRef = useRef(view);
  viewRef.current = view;
  const startRef = useRef(view);
  const [selected, setSelected] = useState<string | null>(null);

  const graph = useMemo<Graph>(
    () => (mode === 'field' ? (fieldGraph({ subjects, know, prior, retention }) as Graph) : (knowledgeGraph({ subjects, know, retention }) as Graph)),
    [mode, subjects, know, prior, retention],
  );
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const hubs = useMemo(() => graph.nodes.filter((n) => n.kind === 'subject' || n.kind === 'field').map((n) => n.id), [graph]);
  // The straight-line distance between neighbouring hubs, in map units: the room a hub label has.
  // Hub labels alternate above and below, so each has nearly twice the chord between neighbours.
  const ringR = mode === 'field' ? Math.max(150, 26 * hubs.length) : R_HUB;
  const chord = hubs.length > 1 ? 1.8 * 2 * ringR * Math.sin(Math.PI / hubs.length) : 4 * R_HUB;

  // By subject the layout is fixed; by field it settles over a second or two, drawn as it goes.
  const [layout, setLayout] = useState<Layout>(() => layoutGraph(graph) as Layout);
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (mode === 'subject') { setLayout(layoutGraph(graph) as Layout); setSettling(false); return; }
    const sim = forceLayout(graph);
    let frame = 0;
    let extent = 0;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      const snap = sim.tick(reduced ? 400 : 4);
      extent = Math.max(extent, snap.extent);
      setLayout({ positions: snap.positions, extent: snap.settled ? snap.extent : extent });
      if (snap.settled) { setSettling(false); return; }
      frame = requestAnimationFrame(step);
    };
    setSettling(!reduced);
    step();
    return () => { stopped = true; cancelAnimationFrame(frame); sim.stop(); };
  }, [graph, mode, reduced]);

  // Topics the planner has not placed yet are placed once, all subjects together.
  const [placing, setPlacing] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  useEffect(() => {
    if (!onPlace || graph.placed !== false || placing !== 'idle' || !subjects.length) return;
    setPlacing('running');
    onPlace().then(() => setPlacing('done')).catch(() => setPlacing('failed'));
  }, [onPlace, graph.placed, placing, subjects.length]);

  // The map's own units fit the box at zoom 1; everything else is relative to that.
  const height = Math.min(size.w, windowWidth > 700 ? 520 : 420) || 360;
  // A little margin inside the box, so labels at the edge and the zoom buttons do not collide.
  const unit = size.w ? (0.9 * Math.min(size.w, height)) / (layout.extent * 2) : 1;
  const cx = size.w / 2;
  const cy = height / 2;
  const toScreen = (p: { x: number; y: number }) => ({ x: cx + view.x + p.x * unit * view.k, y: cy + view.y + p.y * unit * view.k });
  const scale = unit * view.k;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w && w !== size.w) setSize({ w, h: height });
  };

  const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
  // A tap picks the nearest node within reach; a drag that moves more than a few points is a pan instead.
  const geomRef = useRef({ cx, cy, unit, k: view.k, x: view.x, y: view.y, layout, graph });
  geomRef.current = { cx, cy, unit, k: view.k, x: view.x, y: view.y, layout, graph };
  const hitTest = (sx: number, sy: number) => {
    const g = geomRef.current;
    let best: { id: string; d: number } | null = null;
    for (const n of g.graph.nodes) {
      const pos = g.layout.positions[n.id];
      if (!pos) continue;
      const px = g.cx + g.x + pos.x * g.unit * g.k;
      const py = g.cy + g.y + pos.y * g.unit * g.k;
      const reach = Math.max(14, nodeRadius(n) * g.unit * g.k + 6);
      const d = Math.hypot(px - sx, py - sy);
      if (d <= reach && (!best || d < best.d)) best = { id: n.id, d };
    }
    setSelected((s) => (best ? (s === best.id ? null : best.id) : null));
  };
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(8)
    .onEnd((e) => hitTest(e.x, e.y));
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(6)
    .onStart(() => { startRef.current = viewRef.current; })
    .onUpdate((e) => setView((v) => ({ ...v, x: startRef.current.x + e.translationX, y: startRef.current.y + e.translationY })));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => { startRef.current = viewRef.current; })
    .onUpdate((e) => setView((v) => ({ ...v, k: clampK(startRef.current.k * e.scale) })));
  const gesture = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));

  const zoom = (f: number) => setView((v) => ({ ...v, k: clampK(v.k * f) }));
  const reset = () => setView({ x: 0, y: 0, k: 1 });
  const moved = view.k !== 1 || view.x !== 0 || view.y !== 0;
  const switchMode = (m: Mode) => { setMode(m); setSelected(null); reset(); };

  const sel = selected ? byId.get(selected) : null;
  const open = (n: Node) => {
    if (onOpen) return onOpen(n);
    if (n.kind === 'subject' && n.subjectId) router.push({ pathname: '/subject/[subjectId]', params: { subjectId: n.subjectId } });
    else if (n.kind === 'topic' && n.subjectId && n.topicId) {
      const learned = n.status === 'learned' || n.status === 'secure' || n.status === 'practising';
      router.push(learned ? { pathname: '/topic/[subjectId]/[topicId]', params: { subjectId: n.subjectId, topicId: n.topicId } } : { pathname: '/session/[subjectId]', params: { subjectId: n.subjectId, topicId: n.topicId } });
    }
  };

  // Lines first, so every node sits on top of them. The selected node's lines are drawn in ink;
  // selecting a field or an area lights everything under it.
  const under = useMemo(() => {
    if (!sel || (sel.kind !== 'field' && sel.kind !== 'area')) return null;
    const ids = new Set<string>([sel.id]);
    for (const n of graph.nodes) if ((sel.kind === 'field' && (n.field === sel.id || n.id === sel.id)) || (sel.kind === 'area' && n.area === sel.id)) ids.add(n.id);
    return ids;
  }, [sel, graph]);
  const isLit = (e: Edge) => (under ? under.has(e.from) && (under.has(e.to) || e.to === sel?.id) : selected != null && (e.from === selected || e.to === selected));
  // A line between two things that are known is drawn in ink, as dark as the weaker recall at
  // its ends; with one end known it is muted; between unknowns it is the faint structure. So the
  // network darkens where knowledge is consolidated and fades where it is slipping.
  const held = (n?: Node) => {
    if (!n) return 0;
    if (n.kind === 'topic') return n.status === 'learned' || n.status === 'secure' ? (typeof n.recall === 'number' ? n.recall : 1) : n.status === 'practising' ? 0.6 : 0;
    if (n.kind === 'field' || n.kind === 'area' || n.kind === 'subject') {
      if ((n.learned ?? 0) > 0) return typeof n.recall === 'number' ? n.recall : 1;
      return n.prior ? (n.prior.verifiedLevel ? 1 : 0.7) : 0;
    }
    return n.kind === 'you' ? 1 : 0; // the fields the learner brought with them stay structural
  };
  const edgeStyle = (e: Edge, lit: boolean) => {
    const base = e.kind === 'spoke' || e.kind === 'root' ? 0.75 : e.kind === 'covers' ? 1.25 : e.kind === 'in' ? 0.9 : 1;
    if (lit) return { stroke: colors.text, width: base * 1.5, opacity: 1 };
    if (e.kind === 'covers') return { stroke: colors.accent, width: base, opacity: 0.7 };
    const a = held(byId.get(e.from));
    const b = held(byId.get(e.to));
    // The structure (topic to area, area to field, field to the learner) darkens more gently than
    // the pathways between ideas, so the pathways stay the thing the eye reads.
    const structural = e.kind === 'in' || e.kind === 'spoke' || e.kind === 'root';
    if (a > 0 && b > 0) return structural ? { stroke: colors.text, width: base, opacity: 0.18 + 0.3 * Math.min(a, b) } : { stroke: colors.text, width: base * 1.35, opacity: 0.3 + 0.55 * Math.min(a, b) };
    if (a > 0 || b > 0) return { stroke: colors.textMuted, width: base, opacity: structural ? 0.35 : 0.5 };
    return { stroke: colors.border, width: base, opacity: e.kind === 'spoke' ? 0.6 : e.kind === 'prereq' && mode === 'field' ? 0.45 : 0.9 };
  };
  // An arc round a hub from twelve o'clock, clockwise, for a share of its topics.
  const arc = (cx0: number, cy0: number, r0: number, share: number) => {
    const f = Math.max(0, Math.min(1, share));
    if (f <= 0) return '';
    if (f >= 0.999) return `M ${cx0} ${cy0 - r0} A ${r0} ${r0} 0 1 1 ${cx0} ${cy0 + r0} A ${r0} ${r0} 0 1 1 ${cx0} ${cy0 - r0}`;
    const a = -Math.PI / 2 + 2 * Math.PI * f;
    return `M ${cx0} ${cy0 - r0} A ${r0} ${r0} 0 ${f > 0.5 ? 1 : 0} 1 ${cx0 + r0 * Math.cos(a)} ${cy0 + r0 * Math.sin(a)}`;
  };

  const labelFont = typography.caption.fontFamily;
  const Halo = ({ x, y, w, h = 15 }: { x: number; y: number; w: number; h?: number }) => (
    <Rect x={x - w / 2} y={y - h + 4} width={w} height={h} rx={3} fill={colors.background} fillOpacity={0.85} />
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <Segmented options={MODES} value={mode} onChange={switchMode} />
      <View
        onLayout={onLayout}
        style={{ height, borderWidth: 1, borderColor: colors.border, borderRadius: rad.md, overflow: 'hidden', backgroundColor: colors.background }}
      >
        {size.w ? (
          <GestureDetector gesture={gesture}>
            <View style={{ flex: 1 }} collapsable={false}>
              <Svg width={size.w} height={height}>
                <G>
                  {graph.edges.map((e, i) => {
                    const a = layout.positions[e.from];
                    const b = layout.positions[e.to];
                    if (!a || !b) return null;
                    const p = toScreen(a);
                    const q = toScreen(b);
                    const lit = isLit(e);
                    const st = edgeStyle(e, lit);
                    return (
                      <Line
                        key={i}
                        x1={p.x}
                        y1={p.y}
                        x2={q.x}
                        y2={q.y}
                        stroke={st.stroke}
                        strokeWidth={st.width}
                        strokeDasharray={e.kind === 'bridge' && !lit ? '3 3' : undefined}
                        opacity={st.opacity}
                      />
                    );
                  })}
                </G>
                <G>
                  {graph.nodes.map((n) => {
                    const pos = layout.positions[n.id];
                    if (!pos) return null;
                    const p = toScreen(pos);
                    const r = Math.max(2.5, nodeRadius(n) * scale);
                    const isSel = n.id === selected;
                    if (n.kind === 'you') {
                      return (
                        <G key={n.id}>
                          <Circle cx={p.x} cy={p.y} r={r} fill={colors.text} />
                          <Circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke={isSel ? colors.text : colors.border} strokeWidth={1} />
                        </G>
                      );
                    }
                    if (n.kind === 'know') {
                      const s = r * 2;
                      return (
                        <G key={n.id}>
                          <Rect x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} rx={1.5} fill={colors.textMuted} />
                          {isSel ? <Rect x={p.x - s / 2 - 3} y={p.y - s / 2 - 3} width={s + 6} height={s + 6} rx={3} fill="none" stroke={colors.text} strokeWidth={1} /> : null}
                        </G>
                      );
                    }
                    if (n.kind === 'subject' || n.kind === 'field') {
                      const recall = typeof n.recall === 'number' ? n.recall : null;
                      const fillOpacity = recall == null ? 1 : 0.35 + 0.65 * recall;
                      const started = (n.learned ?? 0) > 0;
                      // The label sits on a pale halo, so the dots it crosses do not break it up. Neighbouring
                      // hubs alternate above and below, and a label is cut to the room between hubs at this zoom.
                      const hubIdx = hubs.indexOf(n.id);
                      const room = Math.max(40, chord * scale - 6);
                      const maxChars = Math.max(8, Math.floor((room - 8) / 6.2));
                      const text = n.label.length > maxChars ? n.label.slice(0, Math.max(6, maxChars - 1)).trimEnd() + '…' : n.label;
                      const below = hubIdx % 2 === 0;
                      const lab = { x: p.x, y: below ? p.y + r + 17 : p.y - r - 9, w: text.length * 6.2 + 8 };
                      const total = n.kind === 'field' ? n.topics ?? 0 : n.total ?? 0;
                      const learnedShare = total ? (n.learned ?? 0) / total : 0;
                      const secureShare = total ? (n.secure ?? 0) / total : 0;
                      const ring = r + 3.5;
                      // A hub the learner brought with them: its arc is the rung they stand at, muted until a
                      // check has shown it, then in ink; the disc fills once it is shown.
                      const pr = n.prior;
                      const shown = !!pr?.verifiedLevel;
                      const rung = pr ? (STAGES.findIndex((st) => st.id === (pr.verifiedLevel || pr.level)) + 1) / STAGES.length : 0;
                      const filled = started || shown;
                      return (
                        <G key={n.id}>
                          <Circle cx={p.x} cy={p.y} r={r} fill={filled ? colors.text : colors.background} fillOpacity={filled ? (started ? fillOpacity : 0.85) : 1} stroke={colors.text} strokeWidth={1.25} strokeDasharray={pr && !shown && !started ? '3 2' : undefined} />
                          {/* The proficiency arc: the share learned in ink over a faint track, the share secure in the accent on top. */}
                          <Circle cx={p.x} cy={p.y} r={ring} fill="none" stroke={colors.border} strokeWidth={1.5} />
                          {pr && rung > 0 && !learnedShare ? <Path d={arc(p.x, p.y, ring, rung)} fill="none" stroke={shown ? colors.text : colors.textMuted} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={shown ? undefined : '2 2'} /> : null}
                          {learnedShare > 0 ? <Path d={arc(p.x, p.y, ring, learnedShare)} fill="none" stroke={colors.text} strokeWidth={1.5} strokeLinecap="round" /> : null}
                          {secureShare > 0 ? <Path d={arc(p.x, p.y, ring, secureShare)} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" /> : null}
                          {isSel ? <Circle cx={p.x} cy={p.y} r={ring + 3} fill="none" stroke={colors.text} strokeWidth={1} /> : null}
                          {view.k >= 0.9 || isSel ? (
                            <>
                              <Halo x={lab.x} y={lab.y} w={lab.w} />
                              <SvgText x={lab.x} y={lab.y} fontSize={11} fontFamily={labelFont} fill={colors.text} textAnchor="middle">
                                {text}
                              </SvgText>
                            </>
                          ) : null}
                        </G>
                      );
                    }
                    if (n.kind === 'area') {
                      const recall = typeof n.recall === 'number' ? n.recall : null;
                      const started = (n.learned ?? 0) > 0;
                      const text = n.label.length > 22 && view.k < 1.6 ? n.label.slice(0, 20).trimEnd() + '…' : n.label;
                      // Area labels need room: on a phone at the default zoom they wait for a pinch.
                      const show = isSel || view.k >= 1.3 || ((n.topics ?? 0) >= 3 && scale >= 0.65);
                      const aTotal = n.topics ?? 0;
                      const aLearned = aTotal ? (n.learned ?? 0) / aTotal : 0;
                      const aSecure = aTotal ? (n.secure ?? 0) / aTotal : 0;
                      const aRing = r + 2.5;
                      const apr = n.prior;
                      const aShown = !!apr?.verifiedLevel;
                      const aRung = apr ? (STAGES.findIndex((st) => st.id === (apr.verifiedLevel || apr.level)) + 1) / STAGES.length : 0;
                      const aFilled = started || aShown;
                      return (
                        <G key={n.id}>
                          <Circle cx={p.x} cy={p.y} r={r} fill={aFilled ? colors.text : colors.background} fillOpacity={aFilled ? (started ? (recall == null ? 1 : 0.35 + 0.65 * recall) : 0.85) : 1} stroke={colors.text} strokeWidth={1} strokeDasharray={apr && !aShown && !started ? '3 2' : undefined} />
                          {started || apr ? <Circle cx={p.x} cy={p.y} r={aRing} fill="none" stroke={colors.border} strokeWidth={1.25} /> : null}
                          {apr && aRung > 0 && !aLearned ? <Path d={arc(p.x, p.y, aRing, aRung)} fill="none" stroke={aShown ? colors.text : colors.textMuted} strokeWidth={1.25} strokeLinecap="round" strokeDasharray={aShown ? undefined : '2 2'} /> : null}
                          {aLearned > 0 ? <Path d={arc(p.x, p.y, aRing, aLearned)} fill="none" stroke={colors.text} strokeWidth={1.25} strokeLinecap="round" /> : null}
                          {aSecure > 0 ? <Path d={arc(p.x, p.y, aRing, aSecure)} fill="none" stroke={colors.accent} strokeWidth={1.75} strokeLinecap="round" /> : null}
                          {isSel ? <Circle cx={p.x} cy={p.y} r={aRing + 3} fill="none" stroke={colors.text} strokeWidth={1} /> : null}
                          {show ? (
                            <>
                              <Halo x={p.x} y={p.y + r + 14} w={text.length * 5.6 + 8} h={14} />
                              <SvgText x={p.x} y={p.y + r + 14} fontSize={10} fontFamily={labelFont} fill={colors.textMuted} textAnchor="middle">
                                {text}
                              </SvgText>
                            </>
                          ) : null}
                        </G>
                      );
                    }
                    // A topic: later on the path is a small dot; ready is a ring; in progress a ring with a
                    // centre; learned a filled disc whose brightness is its recall; secure adds the accent ring.
                    const status = n.status ?? 'later';
                    const recall = typeof n.recall === 'number' ? n.recall : null;
                    const fillOpacity = recall == null ? 1 : 0.3 + 0.7 * recall;
                    const inProgress = status === 'learning' || status === 'practising';
                    const learned = status === 'learned' || status === 'secure';
                    const labelled = isSel || (view.k >= 2.2 && (learned || inProgress || status === 'available'));
                    const tlabel = n.label.length > 30 ? n.label.slice(0, 28).trimEnd() + '…' : n.label;
                    const dim = under ? !under.has(n.id) : false;
                    return (
                      <G key={n.id} opacity={dim ? 0.35 : 1}>
                        {status === 'later' ? (
                          <Circle cx={p.x} cy={p.y} r={Math.max(1.5, r * 0.55)} fill={colors.border} />
                        ) : learned ? (
                          <Circle cx={p.x} cy={p.y} r={r} fill={colors.text} fillOpacity={fillOpacity} />
                        ) : (
                          <Circle cx={p.x} cy={p.y} r={r} fill={colors.background} stroke={colors.text} strokeWidth={1} />
                        )}
                        {inProgress ? <Circle cx={p.x} cy={p.y} r={Math.max(1, r * 0.4)} fill={colors.text} /> : null}
                        {status === 'secure' ? <Circle cx={p.x} cy={p.y} r={r + 2.5} fill="none" stroke={colors.accent} strokeWidth={1.25} /> : null}
                        {isSel ? <Circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={colors.text} strokeWidth={1} /> : null}
                        {labelled ? (
                          <>
                            <Halo x={p.x} y={p.y + r + 11} w={tlabel.length * 5.6 + 8} h={14} />
                            <SvgText x={p.x} y={p.y + r + 11} fontSize={10} fontFamily={labelFont} fill={colors.textMuted} textAnchor="middle">
                              {tlabel}
                            </SvgText>
                          </>
                        ) : null}
                      </G>
                    );
                  })}
                </G>
              </Svg>
            </View>
          </GestureDetector>
        ) : null}

        <View style={{ position: 'absolute', right: spacing.sm, top: spacing.sm, flexDirection: 'row', gap: spacing.xs }}>
          <Ctl label="−" onPress={() => zoom(1 / 1.4)} a11y="Zoom out" />
          <Ctl label="+" onPress={() => zoom(1.4)} a11y="Zoom in" />
          {moved ? <Ctl label="Fit" onPress={reset} a11y="Fit the whole map" /> : null}
        </View>
      </View>

      {sel ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: rad.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {sel.label}
            </Text>
            <Text variant="caption" color="textMuted">
              {nodeLine(sel)}
            </Text>
          </View>
          {sel.kind === 'subject' || sel.kind === 'topic' ? <Button label="Open" variant="secondary" fullWidth={false} onPress={() => open(sel)} /> : null}
        </View>
      ) : (
        <Text variant="caption" color="textMuted">
          {placing === 'running'
            ? 'Placing your topics under their fields. A few seconds.'
            : placing === 'failed'
              ? 'Could not place your topics by field just now; they are grouped by subject until then. Filled: learned. Green ring: secure. Dimmer: fading from memory.'
              : settling
                ? 'Settling into place.'
                : mode === 'field'
                  ? 'Grouped by what each idea is, whichever subject teaches it. Hubs grow as you learn; the arc is the share learned, green where it is secure. What you brought with you is dashed until a check has shown it. Dark lines join things you know; they fade as memory does. Tap a field to see what is under it.'
                  : 'Filled: learned. Green ring: secure. Dimmer: fading from memory. Dashed: a link a lesson drew to something you knew. Tap anything.'}
        </Text>
      )}
    </View>
  );
}

function Ctl({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: 32,
        height: 32,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="bodyStrong">{label}</Text>
    </Pressable>
  );
}
