import { Pressable, View } from 'react-native';

import { Button, Ladder, Logo, ProgressBar, Screen, Skeleton, Text } from '@/src/components/ui';
import type { Topic } from '@/src/engine/types';
import type { LiveSubject } from '@/src/features/subjects';
import { aboutMinutes, minutesFor, minutesToday, nextStep, subjectLine, todayLine, type NextStepExtras } from '@/src/features/subjects/summary';
import { useTheme } from '@/src/theme';

export type ApplyPrompt = { subject: LiveSubject; topic: Topic; text: string };

type Props = {
  subjects: LiveSubject[];
  loading: boolean;
  extras?: NextStepExtras;
  // Yesterday's "use it today" task, asked about once.
  apply?: ApplyPrompt | null;
  onApply?: (prompt: ApplyPrompt, done: boolean) => void;
  onStart: (step: ReturnType<typeof nextStep>) => void;
  onOpenSubject: (subjectId: string) => void;
  onAddSubject: () => void;
};

// The one button's label: what it starts, and about how long it takes.
function startLabel(step: ReturnType<typeof nextStep>): string {
  const base =
    step.kind === 'resume'
      ? 'Continue'
      : step.kind === 'review'
        ? 'Start reviews'
        : step.kind === 'probe'
          ? 'Start the check'
          : step.kind === 'check'
            ? 'Take the level check'
            : step.kind === 'mixed'
              ? 'Start mixed practice'
              : step.kind === 'topic'
                ? 'Start'
                : 'Add a subject';
  const m = minutesFor(step);
  return m == null ? base : `${base} · ${aboutMinutes(m)}${step.kind === 'resume' ? ' left' : ''}`;
}

// What is next, as a heading: the thing itself, not the verb.
function nextTitle(step: ReturnType<typeof nextStep>): string {
  switch (step.kind) {
    case 'resume': return step.topic.title;
    case 'review': return `${step.count} ${step.count === 1 ? 'review' : 'reviews'}`;
    case 'probe': return 'Five-minute retention check';
    case 'check': return `${step.stageName} level check`;
    case 'mixed': return 'Mixed practice';
    case 'topic': return step.topic.title;
    default: return 'Nothing due';
  }
}

// The daily screen: what is next and how long it takes, one button, how
// today is going, and where each subject stands on the ladder. Pure
// presentation; app/(app)/(tabs)/learn.tsx feeds it, and the dev preview
// renders it with fixtures.
export function LearnView({ subjects, loading, extras = {}, apply, onApply, onStart, onOpenSubject, onAddSubject }: Props) {
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
          {step.kind === 'resume' ? 'Pick up where you left off' : 'Next'}
        </Text>
        {loading ? <Skeleton height={30} width="60%" /> : <Text variant="title">{nextTitle(step)}</Text>}
        {loading ? <Skeleton height={23} width="80%" /> : <Text variant="body">{todayLine(subjects, extras)}</Text>}
        <View style={{ marginTop: spacing.md }}>
          <Button label={startLabel(step)} onPress={() => onStart(step)} disabled={loading} />
        </View>
      </View>

      {apply && onApply ? (
        <View style={{ marginTop: spacing.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Yesterday&apos;s task
          </Text>
          <Text variant="body">{apply.text}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.xl }}>
            <Pressable onPress={() => onApply(apply, true)} accessibilityRole="button" style={{ paddingVertical: spacing.xs }}>
              <Text variant="bodyStrong">Did it</Text>
            </Pressable>
            <Pressable onPress={() => onApply(apply, false)} accessibilityRole="button" style={{ paddingVertical: spacing.xs }}>
              <Text variant="body" color="textMuted">
                Not yet
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text variant="caption" color="textMuted">
            Today
          </Text>
          <Text variant="caption" color={minutes >= slot ? 'accent' : 'textMuted'}>
            {minutes} of {slot} min
          </Text>
        </View>
        <ProgressBar value={slot ? minutes / slot : 0} tone={minutes >= slot ? 'accent' : 'primary'} />
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
