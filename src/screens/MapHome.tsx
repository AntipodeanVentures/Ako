import { useMemo, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KnowledgeMap } from '@/src/components/KnowledgeMap';
import { Button, Logo, Text } from '@/src/components/ui';
import { fieldGraph, nodeLine } from '@/src/engine/map';
import { dueCards, nextTopic, sittingMinutes } from '@/src/engine/progress';
import type { LiveSubject } from '@/src/features/subjects';
import { ThemeProvider, useTheme } from '@/src/theme';

// The map as the home screen. What the learner knows fills the screen; the numbers above it
// say how much is held and how much is fading; the block below says what today's session does
// to the map and starts it with one tap. Learning is a way of changing the map, so the map comes
// first and the session hangs off it. Dark, so the network reads as a network.

type KnowItem = { id: string; kind: string; title: string; detail?: string };
type PriorField = { id: string; field: string; area: string; level: string; basis: string; verified_level: string | null };
type MapNode = { id: string; kind: string; label: string; status?: string; recall?: number | null; field?: string; area?: string; prior?: { verifiedLevel: string | null } };
type Selected = { label: string; line: string } | null;

type Props = {
  subjects: LiveSubject[];
  know: KnowItem[];
  prior: PriorField[];
  retention?: number;
  now?: Date;
  onStart?: () => void;
  onNav?: (to: 'map' | 'session' | 'record') => void;
};

// An idea is fading once the chance of recalling it has dropped below seven in ten.
const FADING = 0.7;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = (n: number, one: string, many: string) => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;
// "Propellers", "Propellers and Forces", "Propellers and elsewhere": the line stays short.
const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names[0]} and elsewhere`);

// What today's session does to the map, from the map's own data: which ideas are fading and where,
// which are new and where, and about how long the lot takes.
export function todayOnMap(subjects: LiveSubject[], know: KnowItem[], prior: PriorField[], retention = 0.9) {
  const g = fieldGraph({ subjects, know, prior, retention }) as { nodes: MapNode[] };
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const label = (id?: string) => (id ? byId.get(id)?.label ?? '' : '');
  const topics = g.nodes.filter((n) => n.kind === 'topic');
  const held = topics.filter((n) => n.status === 'learned' || n.status === 'secure');
  const fading = held.filter((n) => typeof n.recall === 'number' && n.recall < FADING);
  const fresh = topics.filter((n) => n.status === 'available' || n.status === 'learning');
  const fields = g.nodes.filter((n) => n.kind === 'field');
  const shown = fields.filter((n) => n.prior?.verifiedLevel).length;
  // The place most of a set sits: its field, or its area when the field has several.
  const where = (set: MapNode[]) => {
    const tally = new Map<string, number>();
    for (const n of set) { const k = n.area && label(n.area) !== label(n.field) ? label(n.area) : label(n.field); if (k) tally.set(k, (tally.get(k) ?? 0) + 1); }
    return list([...tally.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]));
  };
  const due = subjects.reduce((n, s) => n + dueCards(s.cards ?? []).length, 0);
  const next = (() => { for (const s of subjects) { const t = nextTopic(s); if (t) return { s, t }; } return null; })();
  const minutes = Math.round(Math.min(due, 20) * 0.5) + (next ? (sittingMinutes(next.s, next.t) as number) : 0);
  const parts: string[] = [];
  if (fading.length) parts.push(`${count(fading.length, 'idea', 'ideas')} fading in ${where(fading)}`);
  if (fresh.length) parts.push(`${parts.length ? count(Math.min(fresh.length, 2), 'new', 'new') : count(Math.min(fresh.length, 2), 'new idea', 'new ideas')} in ${where(fresh.slice(0, 2))}`);
  const line = parts.length ? parts.join(', ') : held.length ? 'Nothing is fading and nothing is due.' : 'Add a subject to begin.';
  return {
    line: line.charAt(0).toUpperCase() + line.slice(1) + (/[.!?]$/.test(line) ? '' : '.'),
    minutes,
    fields: fields.length,
    shown,
    held: held.length,
    fading: fading.length,
  };
}

export function MapHome(props: Props) {
  return (
    <ThemeProvider forceMode="dark">
      <Home {...props} />
    </ThemeProvider>
  );
}

function Home({ subjects, know, prior, retention = 0.9, now = new Date(), onStart, onNav }: Props) {
  const { colors, spacing } = useTheme();
  const [mapHeight, setMapHeight] = useState(0);
  const [sel, setSel] = useState<Selected>(null);
  const today = useMemo(() => todayOnMap(subjects, know, prior, retention), [subjects, know, prior, retention]);
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const onMapLayout = (e: LayoutChangeEvent) => { const h = Math.round(e.nativeEvent.layout.height); if (h && h !== mapHeight) setMapHeight(h); };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Logo size={20} />
        <Text variant="caption" color="textMuted">
          {date}
        </Text>
      </View>

      {/* What is known, in three numbers. */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flexDirection: 'row', gap: spacing.xl }}>
        <Figure n={today.fields} label={today.fields === 1 ? 'field' : 'fields'} sub={today.shown ? `${today.shown} shown in a check` : 'none checked yet'} />
        <Figure n={today.held} label="ideas held" sub={`kept at ${Math.round(retention * 100)}%`} />
        <Figure n={today.fading} label="fading" sub={today.fading ? 'back in today' : 'nothing slipping'} tone={today.fading ? 'warning' : 'textMuted'} />
      </View>

      {/* The map fills whatever is left between the numbers and the session. */}
      <View style={{ flex: 1, marginTop: spacing.sm }} onLayout={onMapLayout}>
        {mapHeight ? (
          <KnowledgeMap subjects={subjects} know={know} prior={prior} retention={retention} canvas height={mapHeight} onSelect={(n) => setSel(n ? { label: n.label, line: nodeLine(n) } : null)} onOpen={() => {}} />
        ) : null}
      </View>

      {/* Today: what the session does to the map, and one button. A tapped node takes the line over. */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="eyebrow" color="textMuted">
            {sel ? 'On the map' : 'Today'}
          </Text>
          <Text variant="subtitle" numberOfLines={3}>
            {sel ? sel.label : today.line}
          </Text>
          {sel ? (
            <Text variant="caption" color="textMuted">
              {sel.line}
            </Text>
          ) : null}
        </View>
        <Button label={today.minutes ? `Start · ${today.minutes} min` : 'Start'} onPress={onStart ?? (() => {})} />
      </View>

      {/* Three places: the map, the session, the record. */}
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
        {(['map', 'session', 'record'] as const).map((to) => (
          <Pressable key={to} onPress={() => onNav?.(to)} accessibilityRole="tab" accessibilityState={{ selected: to === 'map' }} style={{ flex: 1, paddingVertical: spacing.md, alignItems: 'center' }}>
            <Text variant="caption" color={to === 'map' ? 'text' : 'textMuted'}>
              {to === 'map' ? 'Map' : to === 'session' ? 'Session' : 'Record'}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Figure({ n, label, sub, tone = 'text' }: { n: number; label: string; sub: string; tone?: 'text' | 'textMuted' | 'warning' }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
        <Text variant="figureSmall" style={{ color: colors[tone] }}>
          {n}
        </Text>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </View>
      <Text variant="caption" color="textMuted" numberOfLines={1} style={{ fontSize: 11 }}>
        {sub}
      </Text>
    </View>
  );
}
