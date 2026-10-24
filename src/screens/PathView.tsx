import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Ladder, Text, TextField } from '@/src/components/ui';
import { STAGES, stageName } from '@/src/engine/ladder';
import { cleanOutcome } from '@/src/engine/normalise';
import { levelCheckReady, stagePosition, stageProgress, topicStatus } from '@/src/engine/progress';
import type { Topic } from '@/src/engine/types';
import { aiErrorCopy } from '@/src/features/ai/client';
import { useInvalidateSubject, type LiveSubject } from '@/src/features/subjects';
import { adaptPlan } from '@/src/features/subjects/adapt';
import { extendPlanTo, nextStageToPlan } from '@/src/features/subjects/extend';
import { aimLine, subjectLine } from '@/src/features/subjects/summary';
import { useTheme } from '@/src/theme';

// One subject's ladder: where you stand, what the next level means here,
// when it is expected, and every planned topic with its state.
export function SubjectPath({ subj, onOpenTopic }: { subj: LiveSubject; onOpenTopic?: (topicId: string) => void }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const open = (topicId: string) =>
    onOpenTopic ? onOpenTopic(topicId) : router.push({ pathname: '/session/[subjectId]', params: { subjectId: subj.id, topicId } });
  const line = subjectLine(subj);
  const pos = stagePosition(subj);
  const cur = STAGES[pos.currentIdx];
  const def = subj.plan.stages.find((s) => s.id === cur.id);
  const aim = aimLine(subj);
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
      setRethinkResult(a.notes?.length ? `${a.notes.length} change${a.notes.length === 1 ? '' : 's'} made; see below.` : 'Looked at it against what you said and what you have done so far: no change needed.');
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
      <Text variant="title">{line.title}</Text>
      <View style={{ marginTop: spacing.xl }}>
        <Ladder reached={line.reached} current={line.current} progress={line.progress} labels height={8} />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Text variant="heading" color="accent">
          {line.position}
        </Text>
        {def?.means ? <Text variant="body">{def.means}</Text> : null}
        {def?.equivalent ? (
          <Text variant="caption" color="textMuted">
            Comparable to {def.equivalent}
          </Text>
        ) : null}
      </View>

      {checkStage ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text variant="caption" color="textMuted">
            Every {checkStage.name} topic is learned. Eight to ten questions, from memory.
          </Text>
          <Button
            label={`Take the ${checkStage.name} level check`}
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
          <Button label={`Write the ${stageName(toPlan)} topics`} onPress={extend} loading={extending} variant="secondary" />
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
                const st = subj.topicState[t.id] as { attempts?: number; reopenedAt?: number } | undefined;
                const status = topicStatus(subj, t);
                const note = status === 'learning' ? (st?.reopenedAt ? 'again' : Number(st?.attempts) ? 'again, simpler' : null) : status === 'known' ? 'known' : null;
                return <TopicRow key={t.id} topic={t} status={status} note={note} onPress={() => open(t.id)} />;
              })}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
            </View>
          </View>
        );
      })}

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
            <Button label="Rethink my path" onPress={rethink} loading={rethinking} />
            <Pressable onPress={() => setRethinkOpen(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text variant="caption" color="textMuted">
                Cancel
              </Text>
            </Pressable>
          </View>
        ) : (
          <Button label="Rethink my path" variant="secondary" onPress={() => setRethinkOpen(true)} loading={rethinking} />
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
                  {new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {h.reason.split('.')[0]}
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

function TopicRow({ topic, status, note, onPress }: { topic: Topic; status: string; note?: string | null; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  const learned = status === 'mastered' || status === 'known';
  const open = status === 'available' || status === 'learning' || status === 'practising';
  const icon = learned ? 'checkmark-circle' : open ? 'ellipse-outline' : 'lock-closed-outline';
  const iconColor = learned ? colors.accent : open ? colors.text : colors.border;
  return (
    <Pressable
      onPress={open || learned ? onPress : undefined}
      disabled={!open && !learned}
      accessibilityRole="button"
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
      <Ionicons name={icon} size={18} color={iconColor} style={{ marginTop: 3 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" color={open || learned ? 'text' : 'textMuted'}>
          {topic.title}
          {note ? (
            <Text variant="body" color="accent">
              {'  ·  ' + note}
            </Text>
          ) : null}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {topic.summary}
        </Text>
        <Text variant="caption" color="textMuted">
          {topic.minutes} min{topic.threshold ? '  ·  key idea' : ''}
        </Text>
      </View>
    </Pressable>
  );
}
