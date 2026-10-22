import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Segmented, Text, TextField } from '@/src/components/ui';
import { STAGES, START_LEVELS } from '@/src/engine/ladder';
import type { StageId } from '@/src/engine/types';
import { useAuth } from '@/src/features/auth';
import {
  answersToIntake,
  fallbackQuestions,
  fetchIntakeQuestions,
  type IntakeQuestion,
} from '@/src/features/subjects/intakeQuestions';
import {
  currentPlan,
  resetBuild,
  startBuild,
  usePlanBuild,
} from '@/src/features/subjects/planBuilder';
import { useTheme } from '@/src/theme';

type StartLevel = (typeof START_LEVELS)[number];

const LEVELS: { value: StartLevel; label: string; hint: string }[] = [
  { value: 'Complete beginner', label: 'New to it', hint: 'Start from the very beginning, with no terms assumed.' },
  { value: 'Know a little', label: 'Know a little', hint: 'You have picked some up; the first topics fill the gaps.' },
  { value: 'Intermediate', label: 'Intermediate', hint: 'You can already do the basics. The plan starts a level up.' },
  { value: 'Used to be good, now rusty', label: 'Rusty', hint: 'You knew this once. A quick placement skips what comes back.' },
];

const AIMS: { value: StageId; label: string }[] = STAGES.slice(1).map((s) => ({ value: s.id as StageId, label: s.name }));

const SLOTS = [5, 15, 30, 45] as const;

// Three choices, then three questions written for the subject (what for,
// what contact so far, where to aim), then the path is written while the
// learner watches the levels arrive. The draft is enough to start on; the
// reviewed version replaces it in the background.
const QUESTIONS_WAIT_MS = 7000;
export default function PlaceScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { subject } = useLocalSearchParams<{ subject: string }>();
  const build = usePlanBuild();
  const [current, setCurrent] = useState<StartLevel>('Know a little');
  const [target, setTarget] = useState<StageId>('s3');
  const [minutes, setMinutes] = useState<number>(15);
  const [step, setStep] = useState<'levels' | 'focus'>('levels');
  const [questions, setQuestions] = useState<IntakeQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Ask for the subject's questions as soon as we know the subject, so they
  // are ready by the time the three choices are made. If they are slow,
  // the plain versions stand in rather than making the learner wait.
  useEffect(() => {
    if (!subject) return;
    let live = true;
    const timer = setTimeout(() => { if (live) setQuestions((q) => q ?? fallbackQuestions); }, QUESTIONS_WAIT_MS);
    fetchIntakeQuestions(subject, current, target).then((qs) => {
      if (live) setQuestions((q) => q ?? qs);
    });
    return () => { live = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  // A new subject means a fresh build.
  useEffect(() => {
    if (build.intake && build.intake.subject !== subject) resetBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const building = build.status !== 'idle' && build.intake?.subject === subject;
  const plan = building ? currentPlan(build) : null;
  const canStart = building && Boolean(build.subjectId) && (build.status === 'draft' || build.status === 'saving' || build.status === 'ready');

  const begin = () => {
    if (!session?.user.id || !subject) return;
    startBuild(session.user.id, {
      subject,
      target,
      current,
      hours: Math.max(1, Math.round((minutes * 6) / 60)),
      minutes,
      ...answersToIntake(questions ?? fallbackQuestions, answers),
    });
  };

  const aimHint = STAGES.find((s) => s.id === target)?.blurb ?? '';

  return (
    <Screen scroll width="narrow">
      <View style={{ gap: spacing.xs }}>
        <Text variant="eyebrow" color="textMuted">
          Your path
        </Text>
        <Text variant="title">{plan?.title || subject}</Text>
      </View>

      {!building && step === 'focus' ? (
        <View style={{ gap: spacing.xl, marginTop: spacing.xxl }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="heading">Before it is written</Text>
            <Text variant="body" color="textMuted">
              Three questions, so the path is shaped around you. A line each is plenty, and any can be left blank.
            </Text>
          </View>
          {!questions ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text variant="caption" color="textMuted">
                Working out what to ask about {subject}
              </Text>
            </View>
          ) : (
            questions.map((q) => (
              <TextField
                key={q.slot}
                label={q.q}
                labelVariant="question"
                value={answers[q.slot] ?? ''}
                onChangeText={(v) => setAnswers((a) => ({ ...a, [q.slot]: v }))}
                placeholder={q.hint}
                multiline
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
            ))
          )}
        </View>
      ) : !building ? (
        <View style={{ gap: spacing.xl, marginTop: spacing.xxl }}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Where are you now?</Text>
            <Segmented options={LEVELS} value={current} onChange={setCurrent} wrap />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Aim for</Text>
            <Segmented
              options={AIMS.map((a) => ({ ...a, hint: a.value === target ? aimHint : undefined }))}
              value={target}
              onChange={setTarget}
            />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Time on most days</Text>
            <Segmented
              options={SLOTS.map((m) => ({ value: String(m), label: `${m} min` }))}
              value={String(minutes)}
              onChange={(v) => setMinutes(Number(v))}
            />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="bodyStrong">
              {build.status === 'building' ? 'Writing your path' : build.status === 'error' ? 'Could not write the path' : 'Five levels'}
            </Text>
            <Text variant="caption" color="textMuted">
              {plan
                ? `${plan.topics.length} topics to start`
                : `${build.progress.stages} of 5 levels`}
            </Text>
          </View>

          <View>
            {STAGES.map((s, i) => {
              const written = plan ? true : i < build.progress.stages;
              const active = !plan && i === build.progress.stages && build.status === 'building';
              const def = plan?.stages[i];
              const planned = plan ? plan.topics.filter((t) => t.stage === s.id).length : 0;
              return (
                <View
                  key={s.id}
                  style={{
                    flexDirection: 'row',
                    gap: spacing.md,
                    paddingVertical: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    opacity: written || active ? 1 : 0.35,
                  }}
                >
                  <View style={{ width: 22, alignItems: 'center', paddingTop: 2 }}>
                    {active ? (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    ) : (
                      <Text variant="caption" color={written ? 'text' : 'textMuted'}>
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm }}>
                      <Text variant="bodyStrong">{s.name}</Text>
                      {planned ? (
                        <Text variant="caption" color="accent">
                          {planned} topics
                        </Text>
                      ) : null}
                    </View>
                    {def?.equivalent ? (
                      <Text variant="caption">{def.equivalent}</Text>
                    ) : null}
                    {def ? (
                      <Text variant="caption" color="textMuted">
                        {def.means}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>

          {build.status === 'error' ? (
            <Text variant="caption" color="danger">
              {build.error}
            </Text>
          ) : build.status === 'draft' || build.status === 'saving' ? (
            <Text variant="caption" color="textMuted">
              A second pass is checking the order and the gaps. It finishes while you start.
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ flex: 1, minHeight: spacing.xxl }} />

      <View style={{ gap: spacing.md }}>
        {!building && step === 'levels' ? (
          <Button label="Next" onPress={() => setStep('focus')} />
        ) : !building ? (
          <Button label="Write my path" onPress={begin} disabled={!questions} />
        ) : build.status === 'error' ? (
          <Button label="Try again" onPress={begin} />
        ) : (
          <Button
            label={canStart ? 'Start' : 'Writing your path'}
            onPress={() => router.replace('/learn')}
            loading={!canStart}
          />
        )}
        {!building && step === 'levels' ? (
          <Text variant="caption" color="textMuted" center>
            Three quick questions next, then your path. You can change any of this later.
          </Text>
        ) : !building ? (
          <Pressable onPress={() => setStep('levels')} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              Back
            </Text>
          </Pressable>
        ) : building && build.status === 'building' && !build.subjectId ? (
          <Pressable onPress={() => { resetBuild(); setStep('focus'); }} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              Change my answers
            </Text>
          </Pressable>
        ) : (
          <Text variant="caption" color="textMuted" center>
            About a minute. You can change any of this later.
          </Text>
        )}
      </View>
    </Screen>
  );
}
