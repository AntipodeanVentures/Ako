import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/src/components/ui';
import { STAGES, stageIdx, stageName } from '@/src/engine/ladder';
import { topicRecall } from '@/src/engine/map';
import { isLearned, isSecure, stagePosition } from '@/src/engine/progress';
import type { LiveSubject } from '@/src/features/subjects';
import { ThemeProvider, useTheme } from '@/src/theme';

// The record: what the learner knows, as a document of record rather than a dashboard. Levels
// shown in a check first, since those are the claim the app can stand behind; then what has
// been learned here and how much of it is holding; then what the learner says they know but
// has not yet shown. Light, set like a statement, nothing playful. This is the page an
// employer reads and the page that says the data is the business.

type PriorField = {
  id: string; field: string; area: string; level: string; basis: string;
  verified_level: string | null; verified_at?: string | null; verified?: { score: number; asked: number } | null;
};

type Props = {
  name: string;
  subjects: LiveSubject[];
  prior: PriorField[];
  // The code printed on the record, for someone checking it is real.
  code?: string;
  issued?: Date;
  retention?: number;
  onShare?: () => void;
};

const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
// The usual anchor for a rung, short enough for a table cell.
const ANCHOR: Record<string, string> = { s1: 'FHEQ 4 · CEFR A2', s2: 'FHEQ 5 · CEFR B1', s3: 'FHEQ 6 · CEFR B2', s4: 'FHEQ 7 · CEFR C1', s5: 'FHEQ 8 · CEFR C2' };
const rung = (id: string) => `Rung ${stageIdx(id) + 1} of ${STAGES.length}`;

export function RecordView(props: Props) {
  return (
    <ThemeProvider forceMode="light">
      <Record {...props} />
    </ThemeProvider>
  );
}

function Record({ name, subjects, prior, code = '7K2Q-M4', issued = new Date(), retention = 0.9, onShare }: Props) {
  const { colors, spacing } = useTheme();
  const shown = prior.filter((f) => f.verified_level);
  const claimed = prior.filter((f) => !f.verified_level);
  const learned = subjects.map((s) => {
    const pos = stagePosition(s) as { reached: number; currentIdx: number };
    const topics = s.plan.topics.filter((t) => isLearned(s, t));
    const secure = topics.filter((t) => isSecure(s, t)).length;
    const recalls = topics.map((t) => topicRecall(s, t, Date.now(), retention)).filter((r): r is number => typeof r === 'number');
    const recall = recalls.length ? recalls.reduce((a, b) => a + b, 0) / recalls.length : null;
    const def = pos.reached >= 0 ? s.plan.stages.find((st) => st.id === STAGES[pos.reached].id) : null;
    return { id: s.id, title: s.plan.title, reached: pos.reached, working: STAGES[pos.currentIdx]?.name ?? '', learned: topics.length, total: s.plan.topics.length, secure, recall, marker: def?.equivalent ?? '' };
  }).filter((s) => s.learned > 0);
  const held = learned.reduce((n, s) => n + s.learned, 0);
  const recalls = learned.map((s) => s.recall).filter((r): r is number => typeof r === 'number');
  const recallNow = recalls.length ? Math.round((recalls.reduce((a, b) => a + b, 0) / recalls.length) * 100) : null;

  return (
    <Screen scroll width="reading">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="eyebrow" color="textMuted">
          Record of knowledge
        </Text>
        <Button label="Share" variant="ghost" fullWidth={false} onPress={onShare ?? (() => {})} />
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Text variant="display">{name}</Text>
        <Text variant="body" color="textMuted">
          What {name.split(' ')[0]} knows, as shown in checks taken from memory and in daily recall. Issued {fmtDate(issued)}.
        </Text>
        <Text variant="caption" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
          Verify this record at ako.app/r/{code}
        </Text>
      </View>

      <View style={{ marginTop: spacing.xxl, flexDirection: 'row', gap: spacing.xl, paddingVertical: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.text }}>
        <Stat n={String(shown.length)} label={shown.length === 1 ? 'level shown' : 'levels shown'} />
        <Stat n={String(held)} label="ideas held" />
        <Stat n={recallNow == null ? '–' : `${recallNow}%`} label="recall today" />
      </View>

      <Section title="Shown in a check" note="Two questions per rung, from memory. A rung counts when its questions are mostly right and every rung below it passed.">
        {shown.length ? shown.map((f) => (
          <Row
            key={f.id}
            left={f.area ? `${f.field} › ${f.area}` : f.field}
            leftSub={f.basis}
            right={stageName(f.verified_level as string)}
            rightSub={[f.verified ? `${f.verified.score % 1 ? f.verified.score.toFixed(1) : f.verified.score} of ${f.verified.asked}` : '', fmtDate(f.verified_at)].filter(Boolean).join(' · ')}
            anchor={`${rung(f.verified_level as string)} · ${ANCHOR[f.verified_level as string] ?? ''}`}
          />
        )) : <Empty text="Nothing shown yet." />}
      </Section>

      <Section title="Learned here" note="Ideas learned on Ako and reviewed on a schedule. Secure means recalled on separate days after it was learned.">
        {learned.length ? learned.map((s) => (
          <Row
            key={s.id}
            left={s.title}
            leftSub={`${s.learned} of ${s.total} ideas · ${s.secure} secure`}
            right={s.reached >= 0 ? stageName(STAGES[s.reached].id) : 'Started'}
            rightSub={s.recall != null ? `${Math.round(s.recall * 100)}% recalled today` : ''}
            anchor={`${s.working} in progress${s.reached >= 0 ? ` · ${rung(STAGES[s.reached].id)}` : ''}${s.marker ? ` · about ${s.marker}` : ''}`}
          />
        )) : <Empty text="Nothing learned here yet." />}
      </Section>

      <Section title="As described, not yet checked" note="What the learner says they know. It stays a claim until a check shows it.">
        {claimed.length ? claimed.map((f) => (
          <Row key={f.id} left={f.area ? `${f.field} › ${f.area}` : f.field} leftSub={f.basis} right={stageName(f.level)} rightSub="self-reported" anchor={rung(f.level)} muted />
        )) : <Empty text="Every field has been checked." />}
      </Section>

      <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
        <Text variant="eyebrow" color="textMuted">
          How this record is made
        </Text>
        <Text variant="caption" color="textMuted">
          {'Five rungs, named by what a person can do, anchored to the UK higher education framework (FHEQ), the European language scale (CEFR), and the licences and gradings of each field. A level is shown only by questions answered from memory, with no notes, days after anything was taught. Recall figures are the scheduler\'s estimate from every review taken, not a self-assessment.'}
        </Text>
      </View>
    </Screen>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="figureSmall">{n}</Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <View style={{ gap: spacing.xs, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.text }}>
        <Text variant="heading">{title}</Text>
        <Text variant="caption" color="textMuted">
          {note}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Row({ left, leftSub, right, rightSub, anchor, muted }: { left: string; leftSub: string; right: string; rightSub: string; anchor: string; muted?: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.lg }}>
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
          {left}
        </Text>
        <Text variant="bodyStrong" color={muted ? 'textMuted' : 'text'} style={{ textAlign: 'right' }}>
          {right}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.lg }}>
        <Text variant="caption" color="textMuted" style={{ flex: 1 }} numberOfLines={2}>
          {leftSub}
        </Text>
        <Text variant="caption" color="textMuted" style={{ textAlign: 'right', fontVariant: ['tabular-nums'] }}>
          {rightSub}
        </Text>
      </View>
      {anchor ? (
        <Text variant="caption" color="textMuted" style={{ fontSize: 11 }}>
          {anchor}
        </Text>
      ) : null}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.md }}>
      <Text variant="caption" color="textMuted">
        {text}
      </Text>
    </View>
  );
}
