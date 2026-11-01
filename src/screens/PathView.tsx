import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Ladder, Text, TextField } from '@/src/components/ui';
import { STAGES, stageName , stageName as nameOf } from '@/src/engine/ladder';
import { cleanOutcome } from '@/src/engine/normalise';
import { currentMilestone, dueCards, learnedCount, levelCheckReady, mixedDue, nextTopic, sittingMinutes, stagePosition, stageProgress, stageRetention, topicStatus } from '@/src/engine/progress';
import type { Topic } from '@/src/engine/types';
import { aiErrorCopy } from '@/src/features/ai/client';
import { useInvalidateSubject, type LiveSubject } from '@/src/features/subjects';
import { adaptPlan } from '@/src/features/subjects/adapt';
import { extendPlanTo, nextStageToPlan } from '@/src/features/subjects/extend';
import { aimLine, revisionLabel, subjectLine } from '@/src/features/subjects/summary';
import { useTheme } from '@/src/theme';

// One subject's ladder: where you stand, what the next level means here,
// when it is expected, and every planned topic with its state.
export function SubjectPath({ subj, onOpenTopic }: { subj: LiveSubject; onOpenTopic?: (topicId: string) => void }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const open = (topicId: string) =>
    onOpenTopic ? onOpenTopic(topicId) : router.push({ pathname: '/session/[subjectId]', params: { subjectId: subj.id, topicId } });
  // A learned topic opens its page (cards, drill, today's task), not a whole new lesson.
  const show = (topicId: string) =>
    onOpenTopic ? onOpenTopic(topicId) : router.push({ pathname: '/topic/[subjectId]/[topicId]', params: { subjectId: subj.id, topicId } });
  const nextMilestone = currentMilestone(subj) as { id: string } | null;
  const upNext = nextTopic(subj) as Topic | null;
  const due = dueCards(subj.cards ?? []).length;
  const line = subjectLine(subj);
  const pos = stagePosition(subj);
  const cur = STAGES[pos.currentIdx];
  const def = subj.plan.stages.find((s) => s.id === cur.id);
  const aim = aimLine(subj);
  const retention = stageRetention(subj, cur.id) as { ok: number; n: number; rate: number | null };
  const calibration = subj.stats.calibration as { retention?: number | null; relearn?: number } | undefined;
  // Mixed practice across earlier topics, from four learned and after every three more.
  const learned = learnedCount(subj);
  const mixedReady = Boolean(mixedDue(subj));
  // The level's outcomes are a long list; shown on request.
  const [showOutcomes, setShowOutcomes] = useState(false);
  const checkStage = levelCheckReady(subj) as { id: string; name: string } | null;
  // A level reached but not yet planned (the extension failed, or the target moved).
  const toPlan = !pos.inPlan && !pos.done ? nextStageToPlan(subj) : null;
  const invalidate = useInvalidateSubject();
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  // Rethink my path: the learner says what should change and the model revises the topics still ahead.
  const [rethinking, setRethinking] = useState(false);
  const [rethinkOpen, setRethinkOpen] = useState(false);
  const [rethinkNote, setRethinkNote] = useState('');
  const [rethinkResult, setRethinkResult] = useState<string | null>(null);
  const rethink = async () => {
    setRethinking(true);
    setRethinkResult(null);
    try {
      const a = await adaptPlan(subj, 'The learner asked for the path to be rethought.', { note: rethinkNote.trim() });
      setRethinkResult(a.notes?.length ? `${a.notes.length} change${a.notes.length === 1 ? '' : 's'} made; see below.` : 'No change needed: the topics ahead already fit what you asked for.');
      setRethinkNote('');
      setRethinkOpen(false);
      invalidate();
    } catch (e) {
      setRethinkResult(aiErrorCopy(e));
    } finally {
      setRethinking(false);
    }
  };
  const history = [...(subj.plan.history ?? [])].reverse();
  const extend = async () => {
    if (!toPlan) return;
    setExtending(true);
    setExtendError(null);
    try {
      await extendPlanTo(subj, toPlan);
      invalidate();
    } catch (e) {
      setExtendError(aiErrorCopy(e));
    } finally {
      setExtending(false);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <Text variant="title" style={{ flex: 1 }}>
          {line.title}
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/subject/[subjectId]', params: { subjectId: subj.id } })}
          accessibilityRole="button"
          accessibilityLabel="Subject settings"
          hitSlop={8}
          style={{ paddingTop: 6 }}
        >
          <Text variant="caption" color="textMuted">
            Settings
          </Text>
        </Pressable>
      </View>
      <View style={{ marginTop: spacing.xl }}>
        <Ladder reached={line.reached} current={line.current} progress={line.progress} labels height={8} />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Text variant="heading" color={line.reached >= 0 || line.progress > 0 ? 'accent' : 'text'}>
          {line.position}
        </Text>
        {def?.means ? <Text variant="body">{def.means}</Text> : null}
        {def?.equivalent ? (
          <Text variant="caption" color="textMuted">
            Comparable to {def.equivalent}
          </Text>
        ) : null}
        {retention.n ? (
          <Text variant="caption" color="textMuted">
            {Math.round((retention.rate ?? 0) * 100)}% still known weeks later ({retention.ok} of {retention.n} checks)
            {calibration?.retention ? `. Reviews are timed so you keep about ${Math.round(calibration.retention * 100)}% of it.` : ''}
          </Text>
        ) : null}
      </View>

      {due > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button label={`Review ${due} ${due === 1 ? 'card' : 'cards'} due`} variant="secondary" onPress={() => router.push('/review')} />
        </View>
      ) : null}

      {checkStage ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text variant="caption" color="textMuted">
            Every {checkStage.name} topic is learned. Eight to ten questions, from memory.
          </Text>
          <Button
            label={`Start the ${checkStage.name} level check`}
            onPress={() => router.push({ pathname: '/check/[subjectId]', params: { subjectId: subj.id, stageId: checkStage.id } })}
          />
        </View>
      ) : null}

      {!subj.placement && String(subj.intake.current || '') !== 'Complete beginner' && line.learned < 3 ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button
            label="Skip what I already know"
            variant="secondary"
            onPress={() => router.push({ pathname: '/placement/[subjectId]', params: { subjectId: subj.id } })}
          />
          <Text variant="caption" color="textMuted">
            Ten questions, basic to advanced. Topics you already know are skipped.
          </Text>
        </View>
      ) : null}

      {toPlan ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text variant="caption" color="textMuted">
            You have reached {cur.name}. The {stageName(toPlan)} level is planned from what you have learned so far.
          </Text>
          <Button label={`Plan the ${stageName(toPlan)} level`} onPress={extend} loading={extending} variant="secondary" />
          {extendError ? (
            <Text variant="caption" color="danger">
              {extendError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {def?.outcomes?.length ? (
        <View style={{ marginTop: spacing.lg }}>
          <Pressable
            onPress={() => setShowOutcomes((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showOutcomes }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}
          >
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              What {cur.name} means here
            </Text>
            <Ionicons name={showOutcomes ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </Pressable>
          {showOutcomes ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              {def.outcomes.map((o, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Text variant="body" color="textMuted">
                    –
                  </Text>
                  <Text variant="body" style={{ flex: 1 }}>
                    {cleanOutcome(o)}
                  </Text>
                </View>
              ))}
              {def.external ? (
                <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                  Outside check: {def.external}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {aim ? (
        <View style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs }}>
          <Text variant="eyebrow" color="textMuted">
            Your aim
          </Text>
          <Text variant="heading">
            {aim.name}, {aim.when}
          </Text>
          <Text variant="caption" color="textMuted">
            {aim.how}
          </Text>
        </View>
      ) : null}

      {subj.plan.milestones?.length ? (
        <View style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Milestones
          </Text>
          <Text variant="caption" color="textMuted">
            Whole things you will be able to do, each with a test you can set yourself.
          </Text>
          <View style={{ marginTop: spacing.xs }}>
            {subj.plan.milestones.map((m) => {
              const reached = (subj.milestones as Record<string, { at: number }>)[m.id];
              const current = !reached && nextMilestone?.id === m.id;
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ width: 18, alignItems: 'center', marginTop: 3 }}>
                    {reached ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                    ) : current ? (
                      <Ionicons name="ellipse-outline" size={18} color={colors.text} />
                    ) : (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 6 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" color={reached || current ? 'text' : 'textMuted'}>
                      {m.title}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {current ? 'Try it: ' : 'Test: '}
                      {m.test}
                      {m.stage ? ` · ${nameOf(m.stage)}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>
        </View>
      ) : null}

      {learned >= 4 ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button
            label="Mixed practice"
            variant={mixedReady ? 'primary' : 'secondary'}
            onPress={() => router.push({ pathname: '/mixed/[subjectId]', params: { subjectId: subj.id } })}
          />
          <Text variant="caption" color="textMuted">
            {mixedReady
              ? 'Eight questions that set earlier topics against each other, so you learn to tell them apart. About ten minutes; it comes round after every three new topics.'
              : 'Done for now. It comes round again after three more topics, or in two weeks.'}
          </Text>
        </View>
      ) : null}

      {STAGES.filter((s) => subj.plan.topics.some((t) => t.stage === s.id)).map((s) => {
        const topics = subj.plan.topics.filter((t) => t.stage === s.id);
        const prog = stageProgress(subj, s.id);
        return (
          <View key={s.id} style={{ marginTop: spacing.xxl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm }}>
              <Text variant="heading">{s.name}</Text>
              <Text variant="caption" color="textMuted">
                {prog.learned} of {prog.total} learned
              </Text>
            </View>
            <View>
              {topics.map((t) => {
                const st = subj.topicState[t.id] as { attempts?: number; reopenedAt?: number; retained?: { n: number; last: number } } | undefined;
                const status = topicStatus(subj, t);
                // A word on the row only where it tells the learner something: why a topic is back, that it was
                // skipped as known, or that a later check showed it had slipped.
                const note = status === 'learning'
                  ? (st?.reopenedAt ? 'back after a check' : Number(st?.attempts) ? 'another go, simpler' : null)
                  : status === 'known' ? 'already knew it'
                    : st?.retained?.n ? (st.retained.last ? 'still known' : 'slipped') : null;
                const learnedOrPractising = status === 'mastered' || status === 'known' || status === 'practising';
                return <TopicRow key={t.id} topic={t} status={status} note={note} upNext={upNext?.id === t.id} minutes={sittingMinutes(subj, t) as number} onPress={() => (learnedOrPractising ? show(t.id) : open(t.id))} />;
              })}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
            </View>
          </View>
        );
      })}

      {subj.plan.resources?.length ? (
        <View style={{ marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Worth having alongside
          </Text>
          <Text variant="caption" color="textMuted">
            Books, courses and references the plan was written with in mind. Search by name; links go stale.
          </Text>
          <View style={{ marginTop: spacing.xs }}>
            {subj.plan.resources.map((r, i) => (
              <View key={i} style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 }}>
                <Text variant="body">
                  {r.title}
                  {r.creator ? (
                    <Text variant="body" color="textMuted">
                      {' · ' + r.creator}
                    </Text>
                  ) : null}
                </Text>
                {r.why ? (
                  <Text variant="caption" color="textMuted">
                    {r.why}
                  </Text>
                ) : null}
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="eyebrow" color="textMuted">
            The path adapts
          </Text>
          <Text variant="caption" color="textMuted">
            Topics ahead are revised when one keeps slipping, after a failed level check and at each milestone. You can also ask.
          </Text>
        </View>
        {rethinkOpen ? (
          <View style={{ gap: spacing.md }}>
            <TextField
              label="What should change?"
              value={rethinkNote}
              onChangeText={setRethinkNote}
              placeholder="More of, less of, something you need sooner"
              multiline
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
            <Button label="Update my path" onPress={rethink} loading={rethinking} />
            <Pressable onPress={() => setRethinkOpen(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text variant="caption" color="textMuted">
                Cancel
              </Text>
            </Pressable>
          </View>
        ) : (
          <Button label="Ask for a change" variant="secondary" onPress={() => setRethinkOpen(true)} loading={rethinking} />
        )}
        {rethinkResult ? (
          <Text variant="caption" color="textMuted">
            {rethinkResult}
          </Text>
        ) : null}
        {history.length ? (
          <View style={{ marginTop: spacing.sm }}>
            {history.map((h, i) => (
              <View key={i} style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs }}>
                <Text variant="caption" color="textMuted">
                  {new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {revisionLabel(h.reason)}
                </Text>
                {h.notes.map((n, j) => (
                  <Text key={j} variant="body">
                    {n.why || `${n.op === 'insert' ? 'Added' : n.op === 'remove' ? 'Removed' : n.op === 'move' ? 'Moved' : 'Refocused'}: ${n.title}`}
                  </Text>
                ))}
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// One topic in the list. Learned rows get a tick, the open ones a ring, and
// the ones further ahead a small dot in muted text: they are not locked, just
// later, and a padlock made the path read as a gate.
function TopicRow({ topic, status, note, upNext, minutes, onPress }: { topic: Topic; status: string; note?: string | null; upNext?: boolean; minutes: number; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  const learned = status === 'mastered' || status === 'known';
  const open = status === 'available' || status === 'learning' || status === 'practising';
  return (
    <Pressable
      onPress={open || learned ? onPress : undefined}
      disabled={!open && !learned}
      accessibilityRole="button"
      accessibilityLabel={`${topic.title}${upNext ? ', up next' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 18, alignItems: 'center', marginTop: 3 }}>
        {learned ? (
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
        ) : open ? (
          <Ionicons name="ellipse-outline" size={18} color={upNext ? colors.accent : colors.text} />
        ) : (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 6 }} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <Text variant={upNext ? 'bodyStrong' : 'body'} color={open || learned ? 'text' : 'textMuted'} style={{ flex: 1 }}>
            {topic.title}
            {note ? (
              <Text variant="body" color={note === 'slipped' ? 'warning' : 'textMuted'}>
                {'  ·  ' + note}
              </Text>
            ) : null}
          </Text>
          {upNext ? (
            <Text variant="caption" color="accent">
              up next
            </Text>
          ) : null}
        </View>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {topic.summary}
        </Text>
        <Text variant="caption" color="textMuted">
          about {minutes} min{topic.threshold ? '  ·  key idea' : ''}
        </Text>
      </View>
    </Pressable>
  );
}
