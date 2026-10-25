import { Pressable, View } from 'react-native';

import { Button, Ladder, Logo, Screen, Skeleton, Text } from '@/src/components/ui';
import type { LiveSubject } from '@/src/features/subjects';
import { aboutMinutes, minutesFor, minutesToday, nextStep, subjectLine, todayLine, type NextStepExtras } from '@/src/features/subjects/summary';
import { useTheme } from '@/src/theme';

type Props = {
  subjects: LiveSubject[];
  loading: boolean;
  extras?: NextStepExtras;
  onStart: (step: ReturnType<typeof nextStep>) => void;
  onOpenSubject: (subjectId: string) => void;
  onAddSubject: () => void;
};

// The daily screen: how much today, what is next, and where each subject
// stands on the ladder. One button. Pure presentation; app/(app)/(tabs)/learn.tsx
// feeds it, and the dev preview renders it with fixtures.
// The one button's label: what it starts, and about how long it takes.
function startLabel(step: ReturnType<typeof nextStep>): string {
  const base =
    step.kind === 'resume'
      ? `Continue ${step.topic.title}`
      : step.kind === 'review'
        ? 'Start reviews'
        : step.kind === 'probe'
          ? 'Start the five-minute check'
          : step.kind === 'check'
            ? `Take the ${step.stageName} level check`
            : step.kind === 'mixed'
              ? 'Start mixed practice'
              : step.kind === 'topic'
                ? 'Start'
                : 'Add a subject';
  const m = step.kind === 'probe' ? null : minutesFor(step);
  return m == null ? base : `${base} · ${aboutMinutes(m)}${step.kind === 'resume' ? ' left' : ''}`;
}

export function LearnView({ subjects, loading, extras = {}, onStart, onOpenSubject, onAddSubject }: Props) {
  const { colors, spacing } = useTheme();
  const minutes = Math.round(minutesToday(subjects));
  const step = nextStep(subjects, extras);
  const slot = Number(subjects[0]?.intake.minutes || 15);

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Logo size={20} />
        <Text variant="caption" color="textMuted">
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
        <Text variant="eyebrow" color="textMuted">
          Today
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <Text variant="figure">{minutes}</Text>
          <Text variant="heading" color="textMuted">
            of {slot} min
          </Text>
        </View>
        {loading ? <Skeleton height={23} width="80%" /> : <Text variant="body">{todayLine(subjects, extras)}</Text>}
        <View style={{ marginTop: spacing.md }}>
          <Button
            label={startLabel(step)}
            onPress={() => onStart(step)}
            disabled={loading}
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.xxxl, gap: spacing.md }}>
        <Text variant="eyebrow" color="textMuted">
          Subjects
        </Text>
        {loading && !subjects.length ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : null}
        <View>
          {subjects.map((s) => {
            const line = subjectLine(s);
            return (
              <Pressable
                key={s.id}
                onPress={() => onOpenSubject(s.id)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  paddingVertical: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  gap: spacing.sm,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text variant="heading">{line.title}</Text>
                <Ladder reached={line.reached} current={line.current} progress={line.progress} />
                <View style={{ gap: 2 }}>
                  <Text variant="caption" color="accent">
                    {line.position}
                  </Text>
                  {line.estimate ? (
                    <Text variant="caption" color="textMuted">
                      {line.estimate}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onAddSubject}
            accessibilityRole="button"
            style={({ pressed }) => ({
              paddingVertical: spacing.lg,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="bodyStrong">Add a subject</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
