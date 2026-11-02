import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Screen, Text } from '@/src/components/ui';
import { STAGES, stageIdx, stageName } from '@/src/engine/ladder';
import type { RecordData } from '@/src/features/record/build';
import { ThemeProvider, useTheme, type ThemeMode } from '@/src/theme';

// The record: what the learner knows, as a document of record rather than a dashboard. Levels
// shown in a check first, since those are the claim the app can stand behind; then what has
// been learned here and how much of it is holding; then what the learner says they know but
// has not yet shown. Set like a statement, nothing playful. This is the page an employer reads
// and the page that says the data is the business. Live in the app (with the share controls
// passed in), or public from a snapshot under its code.

type Props = {
  data: RecordData;
  // Live: the learner's own, drawn from today's state. Public: a snapshot opened by its code.
  status: 'live' | 'public';
  code?: string | null;
  // The public link, printed on the record once it has been issued.
  url?: string | null;
  // Live only: the share controls, drawn under the title; the account screen; a check for a claim.
  actions?: ReactNode;
  onAccount?: () => void;
  onVerify?: (fieldId: string) => void;
  // The public page is a document and stays light; the live tab follows the app.
  mode?: ThemeMode;
};

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
// The usual anchor for a rung, short enough for a table cell.
const ANCHOR: Record<string, string> = { s1: 'FHEQ 4 · CEFR A2', s2: 'FHEQ 5 · CEFR B1', s3: 'FHEQ 6 · CEFR B2', s4: 'FHEQ 7 · CEFR C1', s5: 'FHEQ 8 · CEFR C2' };
const rung = (id: string) => `Rung ${stageIdx(id) + 1} of ${STAGES.length}`;
const fmtScore = (n: number) => (n % 1 ? n.toFixed(1) : String(n));

export function RecordView(props: Props) {
  if (props.mode) {
    return (
      <ThemeProvider forceMode={props.mode}>
        <Record {...props} />
      </ThemeProvider>
    );
  }
  return <Record {...props} />;
}

function Record({ data, status, code, url, actions, onAccount, onVerify }: Props) {
  const { colors, spacing } = useTheme();
  const first = data.name.split(' ')[0] || 'this learner';
  const recallNow = data.totals.recall == null ? null : Math.round(data.totals.recall * 100);
  const live = status === 'live';

  return (
    <Screen scroll width="reading">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}>
        <Text variant="eyebrow" color="textMuted">
          Record of knowledge
        </Text>
        {live ? (
          onAccount ? (
            <Pressable onPress={onAccount} accessibilityRole="button" accessibilityLabel="Account" hitSlop={10}>
              <Ionicons name="person-circle-outline" size={26} color={colors.text} />
            </Pressable>
          ) : null
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text variant="caption" color="accent">
              Issued by Ako
            </Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Text variant="display">{data.name || 'Your record'}</Text>
        <Text variant="body" color="textMuted">
          {live
            ? `What ${data.name ? first : 'you'} ${data.name ? 'knows' : 'know'}, as shown in checks taken from memory and in daily recall. As of today.`
            : `What ${first} knows, as shown in checks taken from memory and in daily recall. Issued ${fmtDate(data.issued)}.`}
        </Text>
        {code && url ? (
          <Text variant="caption" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
            {live ? `Anyone with the link can read it: ${url}` : `Code ${code}. This page is Ako's copy of the record; a code that does not open a page is not a record.`}
          </Text>
        ) : null}
      </View>

      {actions ? <View style={{ marginTop: spacing.lg }}>{actions}</View> : null}

      <View style={{ marginTop: spacing.xxl, flexDirection: 'row', gap: spacing.xl, paddingVertical: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.text }}>
        <Stat n={String(data.totals.shown)} label={data.totals.shown === 1 ? 'level shown' : 'levels shown'} />
        <Stat n={String(data.totals.held)} label="ideas held" />
        <Stat n={recallNow == null ? '–' : `${recallNow}%`} label={live ? 'recall today' : 'recall at issue'} />
      </View>

      <Section title="Shown in a check" note="Two questions per rung, from memory. A rung counts when its questions are mostly right and every rung below it passed.">
        {data.shown.length ? data.shown.map((f) => (
          <Row
            key={f.id}
            left={f.area ? `${f.field} › ${f.area}` : f.field}
            leftSub={f.basis}
            right={stageName(f.level)}
            rightSub={[f.score != null && f.asked ? `${fmtScore(f.score)} of ${f.asked}` : '', fmtDate(f.at)].filter(Boolean).join(' · ')}
            anchor={`${rung(f.level)} · ${ANCHOR[f.level] ?? ''}`}
          />
        )) : <Empty text={live ? 'Nothing shown yet. Verify a field below to put it here.' : 'Nothing shown in a check yet.'} />}
      </Section>

      <Section title="Learned here" note="Ideas learned on Ako and reviewed on a schedule. Secure means recalled on separate days after it was learned.">
        {data.learned.length ? data.learned.map((s) => (
          <Row
            key={s.id}
            left={s.title}
            leftSub={`${s.learned} of ${s.total} ideas · ${s.secure} secure`}
            right={s.reached ? stageName(s.reached) : 'Started'}
            rightSub={s.recall != null ? `${Math.round(s.recall * 100)}% ${live ? 'recalled today' : 'recall at issue'}` : ''}
            anchor={`${stageName(s.working)} in progress${s.reached ? ` · ${rung(s.reached)}` : ''}${s.marker ? ` · about ${s.marker}` : ''}`}
          />
        )) : <Empty text="Nothing learned here yet." />}
      </Section>

      <Section title="As described, not yet checked" note={live ? 'What you have told Ako you know. It stays a claim until a check shows it, and claims are listed as claims on the shared record.' : 'What the learner says they know. It stays a claim until a check shows it.'}>
        {data.claimed.length ? data.claimed.map((f) => (
          <Row
            key={f.id}
            left={f.area ? `${f.field} › ${f.area}` : f.field}
            leftSub={f.basis}
            right={stageName(f.level)}
            rightSub="self-reported"
            anchor={rung(f.level)}
            muted
            action={live && onVerify ? { label: 'Verify', onPress: () => onVerify(f.id) } : undefined}
          />
        )) : <Empty text={live ? 'Every field has been checked.' : 'Every field listed has been checked.'} />}
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

function Row({ left, leftSub, right, rightSub, anchor, muted, action }: { left: string; leftSub: string; right: string; rightSub: string; anchor: string; muted?: boolean; action?: { label: string; onPress: () => void } }) {
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.lg }}>
        {anchor ? (
          <Text variant="caption" color="textMuted" style={{ fontSize: 11, flex: 1 }}>
            {anchor}
          </Text>
        ) : <View style={{ flex: 1 }} />}
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8}>
            <Text variant="caption" color="primary" style={{ fontSize: 12 }}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
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
