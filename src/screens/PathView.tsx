import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Ladder, Text } from '@/src/components/ui';
import { STAGES } from '@/src/engine/ladder';
import { estimateText, stagePosition, stageProgress, topicStatus } from '@/src/engine/progress';
import type { StageId, Topic } from '@/src/engine/types';
import type { LiveSubject } from '@/src/features/subjects';
import { subjectLine } from '@/src/features/subjects/summary';
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
  const target = String(subj.intake.target || 's3') as StageId;
  const targetDef = STAGES.find((s) => s.id === target);
  const targetEst = estimateText(subj, target);
  const markers = subj.plan.stages.map((s) => s.equivalent || null);

  return (
    <View>
      <Text variant="title">{line.title}</Text>
      <View style={{ marginTop: spacing.xl }}>
        <Ladder reached={line.reached} current={line.current} progress={line.progress} labels markers={markers} height={8} />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Text variant="heading" color="accent">
          {line.position}
        </Text>
        {def?.means ? <Text variant="body">{def.means}</Text> : null}
      </View>

      {def?.outcomes?.length ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            {cur.name} means you can
          </Text>
          {def.outcomes.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Text variant="body" color="textMuted">
                –
              </Text>
              <Text variant="body" style={{ flex: 1 }}>
                {o}
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

      {targetDef && targetEst ? (
        <View style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs }}>
          <Text variant="eyebrow" color="textMuted">
            {targetDef.name} expected
          </Text>
          <Text variant="heading">{targetEst}</Text>
          <Text variant="caption" color="textMuted">
            From your planned time until two weeks of real study set the pace. It moves as you go.
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
              {topics.map((t) => (
                <TopicRow
                  key={t.id}
                  topic={t}
                  status={topicStatus(subj, t)}
                  onPress={() => open(t.id)}
                />
              ))}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TopicRow({ topic, status, onPress }: { topic: Topic; status: string; onPress: () => void }) {
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
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" color={open || learned ? 'text' : 'textMuted'}>
          {topic.title}
          {topic.threshold ? '  ·  threshold' : ''}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {topic.summary}
        </Text>
      </View>
      <Text variant="caption" color="textMuted">
        {topic.minutes} min
      </Text>
    </Pressable>
  );
}
