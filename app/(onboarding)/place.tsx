import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Chips, Screen, Segmented, Text, TextField } from '@/src/components/ui';
import { STAGES, START_LEVELS } from '@/src/engine/ladder';
import type { StageId } from '@/src/engine/types';
import { useAuth } from '@/src/features/auth';
import { useKnowItems, useProfile, useSaveKnowItems } from '@/src/features/profile';
import { proposeItems, recomputeAbout, toRows } from '@/src/features/profile/know';
import {
  OTHER,
  answersToIntake,
  fallbackQuestions,
  fetchIntakeQuestions,
  type IntakeAnswer,
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

// Three choices, then the two or three questions an expert in the subject
// would ask before writing a course (chosen by the model for this subject
// and learner, with quick answers to tap), then the path is written while
// the learner watches the levels arrive. The draft is enough to start on;
// the reviewed version replaces it in the background.
const QUESTIONS_WAIT_MS = 12000;
const DEMO_QUESTIONS: IntakeQuestion[] = [
  { slot: 'why', q: 'Is this mainly to live by it, to understand it, or to study it formally?', options: ['Live by it', 'Understand it', 'Study it formally'], multi: true, effect: 'Practice versus argument reconstruction.' },
  { slot: 'material', q: 'Have you read any of the three Romans already?', options: ['Marcus Aurelius', 'Seneca', 'Epictetus', 'None yet'], multi: true, effect: 'Which texts to start from.' },
  { slot: 'focus', q: 'Stay with the Romans, or bring in the Greek roots and rival schools?', options: ['Romans only', 'Roots and rivals too'], multi: false, effect: 'Whether Zeno, Aristotle and Epicurus get topics.' },
];
export default function PlaceScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { subject, demo } = useLocalSearchParams<{ subject: string; demo?: string }>();
  const build = usePlanBuild();
  const [current, setCurrent] = useState<StartLevel>('Know a little');
  const [target, setTarget] = useState<StageId>('s3');
  const [minutes, setMinutes] = useState<number>(15);
  const [step, setStep] = useState<'levels' | 'focus'>('levels');
  // One optional line on what they already know, asked only the first time: every lesson's opening
  // and comparisons draw on it, and the You tab is where nobody looks on day one.
  const { profile, refresh } = useProfile();
  const know = useKnowItems();
  const saveKnow = useSaveKnowItems(profile?.id);
  const askKnow = know.isSuccess && !(know.data ?? []).length;
  const [knowLine, setKnowLine] = useState('');
  const [questions, setQuestions] = useState<IntakeQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, IntakeAnswer>>({});
  const answerAt = (i: number): IntakeAnswer => answers[i] ?? { picked: [], other: '' };
  const setAnswer = (i: number, patch: Partial<IntakeAnswer>) => setAnswers((a) => ({ ...a, [i]: { ...answerAt(i), ...patch } }));

  // Ask for the subject's questions as soon as we know the subject, so they
  // are usually ready by the time the three choices are made. If they are
  // slow, the plain versions stand in rather than making the learner wait.
  useEffect(() => {
    if (!subject) return;
    if (__DEV__ && demo) {
      // Development only: sample questions for the preview screen, with no model call.
      setQuestions(DEMO_QUESTIONS);
      return;
    }
    let live = true;
    const timer = setTimeout(() => { if (live) setQuestions((q) => q ?? fallbackQuestions); }, QUESTIONS_WAIT_MS);
    fetchIntakeQuestions(subject, current, target, minutes).then((qs) => {
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
    const intake = answersToIntake(questions ?? fallbackQuestions, answers);
    const line = knowLine.trim();
    startBuild(session.user.id, {
      subject,
      target,
      current,
      hours: Math.max(1, Math.round((minutes * 6) / 60)),
      minutes,
      ...intake,
      background: [line, intake.background].filter(Boolean).join('; '),
    });
    // What they typed becomes "what you already know", read into items in the background; the You tab can prune it.
    if (line && profile) {
      proposeItems(line)
        .then(async (p) => {
          const rows = toRows(p.items, 'typed');
          if (!rows.length) return;
          await saveKnow.mutateAsync(rows);
          await recomputeAbout(profile, rows.map((r, i) => ({ ...r, id: `new-${i}`, profile_id: profile.id, confirmed_at: '', created_at: '' })) as never, p.summary);
          await refresh();
        })
        .catch(() => { /* the line still shaped the plan */ });
    }
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
        <View style={{ gap: spacing.xl, marginTop: spacing.lg }}>
          <Text variant="body" color="textMuted">
            {questions && questions.length === 1
              ? 'One question before it is written. Tap an answer or type your own; it can be left blank.'
              : 'What a good teacher would ask first. Tap an answer or type your own; any can be left blank.'}
          </Text>
          {!questions ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text variant="caption" color="textMuted">
                Working out what to ask about {subject}
              </Text>
            </View>
          ) : (
            questions.map((q, i) => {
              const a = answerAt(i);
              const typing = !q.options.length || a.picked.includes(OTHER) || Boolean(a.other);
              return (
                <View key={i} style={{ gap: spacing.sm }}>
                  <Text variant="bodyStrong">{q.q}</Text>
                  {q.options.length ? (
                    <Chips options={[...q.options, OTHER]} other={OTHER} value={a.picked} onChange={(picked) => setAnswer(i, { picked })} multi={q.multi} />
                  ) : null}
                  {typing ? (
                    <TextField
                      label={q.options.length ? 'In your own words' : 'Your answer'}
                      value={a.other}
                      onChangeText={(other) => setAnswer(i, { other })}
                      placeholder="A line is plenty"
                      multiline
                      style={{ minHeight: 64, textAlignVertical: 'top' }}
                      autoFocus={q.options.length > 0}
                    />
                  ) : null}
                </View>
              );
            })
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
              wrap
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
          {askKnow ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">Anything you already know that might help? Optional</Text>
              <TextField
                label=""
                value={knowLine}
                onChangeText={setKnowLine}
                placeholder="Airline captain, 12 years. Brown belt in judo. Conversational French."
                multiline
                style={{ minHeight: 64, textAlignVertical: 'top' }}
              />
              <Text variant="caption" color="textMuted">
                Lessons compare new ideas with what you know and skip what you can already do.
              </Text>
            </View>
          ) : null}
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
          <>
            <Button
              label={canStart ? 'Start' : 'Writing your path'}
              onPress={() => router.replace('/learn')}
              loading={!canStart}
            />
            {canStart && current !== 'Complete beginner' && build.subjectId ? (
              <Button
                label="Skip what I already know"
                variant="secondary"
                onPress={() => router.replace({ pathname: '/placement/[subjectId]', params: { subjectId: build.subjectId as string } })}
              />
            ) : null}
          </>
        )}
        {!building && step === 'levels' ? (
          <Text variant="caption" color="textMuted" center>
            A couple of quick questions next, then your path. You can change any of this later.
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
            {canStart && current !== 'Complete beginner'
              ? 'Ten questions, basic to advanced; topics you already know are skipped.'
              : 'About a minute. You can change any of this later.'}
          </Text>
        )}
      </View>
    </Screen>
  );
}
