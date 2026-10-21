import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Segmented, Text } from '@/src/components/ui';
import { STAGES, START_LEVELS } from '@/src/engine/ladder';
import type { StageId } from '@/src/engine/types';
import { useAuth } from '@/src/features/auth';
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

// Three choices, then the path is written while the learner watches the
// levels arrive. The draft is enough to start on; the reviewed version
// replaces it in the background.
export default function PlaceScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { subject } = useLocalSearchParams<{ subject: string }>();
  const build = usePlanBuild();
  const [current, setCurrent] = useState<StartLevel>('Know a little');
  const [target, setTarget] = useState<StageId>('s3');
  const [minutes, setMinutes] = useState<number>(15);

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
      background: '',
      why: '',
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

      {!building ? (
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
              {build.status === 'building' ? 'Writing your path' : build.status === 'error' ? 'Could not write the path' : 'Your path'}
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
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                      <Text variant="bodyStrong">{s.name}</Text>
                      {def?.equivalent ? (
                        <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {def.equivalent}
                        </Text>
                      ) : null}
                    </View>
                    {def ? (
                      <Text variant="caption" color="textMuted">
                        {def.means}
                      </Text>
                    ) : null}
                    {planned ? (
                      <Text variant="caption" color="accent">
                        {planned} topics planned
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
        {!building ? (
          <Button label="Write my path" onPress={begin} />
        ) : build.status === 'error' ? (
          <Button label="Try again" onPress={begin} />
        ) : (
          <Button
            label={canStart ? 'Start' : 'Writing your path'}
            onPress={() => router.replace('/learn')}
            loading={!canStart}
          />
        )}
        {building && build.status === 'building' && !build.subjectId ? (
          <Pressable onPress={resetBuild} style={{ alignSelf: 'center', padding: spacing.sm }}>
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
