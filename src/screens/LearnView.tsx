import { Pressable, View } from 'react-native';

import { Button, Ladder, Logo, ProgressBar, Screen, Skeleton, Text } from '@/src/components/ui';
import type { Topic } from '@/src/engine/types';
import type { LiveSubject } from '@/src/features/subjects';
import {
  aboutMinutes,
  dailySlot,
  effort,
  effortLine,
  minutesFor,
  minutesToday,
  nextStep,
  subjectLine,
  todayLine,
  type NextStepExtras,
} from '@/src/features/subjects/summary';
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
            ? 'Start the level check'
            : step.kind === 'mixed'
              ? 'Start mixed practice'
              : step.kind === 'topic'
                ? 'Start'
                : 'Add a subject';
  const m = minutesFor(step);
  return m == null ? base : `${base} · ${aboutMinutes(m)}${step.kind === 'resume' ? ' left' : ''}`;
}

// Which subject the next step belongs to, for the line above the heading
// and the "up next" mark on its row.
function stepSubject(step: ReturnType<typeof nextStep>): { id: string; title: string } | null {
  switch (step.kind) {
    case 'resume':
    case 'topic':
    case 'check':
    case 'mixed':
      return { id: step.subject.id, title: step.subject.plan.title };
    default:
      return null;
  }
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

// The line under the heading: what the step gives you, never the heading again.
function subline(step: ReturnType<typeof nextStep>, line: string): string {
  switch (step.kind) {
    case 'topic':
      return step.topic.summary || line;
    case 'resume':
      return 'Pick it up where you left off.';
    case 'review': {
      const rest = line.replace(/^\d+ reviews?( across your subjects)?(, then |\.$)/, (_m, _a, sep) => (sep === '.' ? '' : 'Then '));
      return rest || 'Nothing else is due today.';
    }
    case 'probe':
      return 'A few questions you have not seen, on ideas from weeks ago. This is the evidence that they stuck.';
    case 'check':
      return 'Eight to ten questions from memory across the level.';
    case 'mixed':
      return `${step.topics.length} earlier topics set against each other, so you learn to tell them apart.`;
    default:
      return line;
  }
}

// The daily screen: what is next and how long it takes, one button, how
// today is going, and where each subject stands. Pure presentation;
// app/(app)/(tabs)/learn.tsx feeds it, and the dev preview renders it with
// fixtures.
export function LearnView({ subjects, loading, extras = {}, apply, onApply, onStart, onOpenSubject, onAddSubject }: Props) {
  const { colors, spacing, radius } = useTheme();
  const minutes = Math.round(minutesToday(subjects));
  const step = nextStep(subjects, extras);
  const slot = dailySlot(subjects);
  const eff = effort(subjects);
  const effLine = effortLine(eff);
  const who = stepSubject(step);

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
          {step.kind === 'resume' ? 'Pick up where you left off' : who ? `Next · ${who.title}` : 'Next'}
        </Text>
        {loading ? <Skeleton height={30} width="60%" /> : <Text variant="title">{nextTitle(step)}</Text>}
        {loading ? <Skeleton height={23} width="80%" /> : <Text variant="body">{subline(step, todayLine(subjects, extras))}</Text>}
        <View style={{ marginTop: spacing.md }}>
          <Button label={startLabel(step)} onPress={() => onStart(step)} disabled={loading} />
        </View>
      </View>

      {apply && onApply ? (
        <View style={{ marginTop: spacing.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, gap: spacing.sm }}>
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
        {effLine ? (
          <Text variant="caption" color="textMuted">
            {effLine}
          </Text>
        ) : null}
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
            // The ladder appears once there is something on it; before that, a row is a name and a line.
            const started = line.reached >= 0 || line.progress > 0;
            const current = who?.id === s.id;
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
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                  <Text variant="heading" style={{ flex: 1 }}>
                    {line.title}
                  </Text>
                  {current ? (
                    <Text variant="caption" color="accent">
                      up next
                    </Text>
                  ) : null}
                </View>
                {started ? <Ladder reached={line.reached} current={line.current} progress={line.progress} /> : null}
                <View style={{ gap: 2 }}>
                  <Text variant="caption" color={started ? 'accent' : 'textMuted'}>
                    {line.position}
                    {line.estimate && started ? `  ·  ${line.estimate}` : ''}
                  </Text>
                  {!started && line.estimate ? (
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
