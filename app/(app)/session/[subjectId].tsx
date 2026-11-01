import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Missing, Screen, Text } from '@/src/components/ui';
import { useProfile } from '@/src/features/profile';
import { useSession } from '@/src/features/session/useSession';
import { useInvalidateSubject, useLiveSubjects, type LiveSubject } from '@/src/features/subjects';
import { DoneStep, DrillStep, LearnStep, Notice, PracticeStep, RecallStep, RoleplayStep, StepStrip, WarmStep } from '@/src/screens/SessionSteps';
import { useTheme } from '@/src/theme';

export default function SessionRoute() {
  const { subjectId, topicId } = useLocalSearchParams<{ subjectId: string; topicId?: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const subj = subjects.find((s) => s.id === subjectId);
  const [frozen] = useState<{ subj: LiveSubject | null }>({ subj: null });
  // The session mutates one subject object for its whole life; a refetch
  // must not swap it from under the engine, so the first loaded copy is kept.
  if (subj && !frozen.subj) frozen.subj = subj;
  const live = frozen.subj;

  if (!live) {
    return <Missing loading={loading} title="This subject is no longer here" body="It may have been put away or deleted on another device." />;
  }
  const tid = topicId || live.plan.topics[0]?.id;
  if (!tid) {
    return <Missing title="No topics to study yet" body="This subject's path has no topics written. Open it from the Path tab to plan the first level." />;
  }
  return <SessionScreen subj={live} topicId={tid} retention={Number(profile?.retention ?? 0.9)} />;
}

function SessionScreen({ subj, topicId, retention }: { subj: LiveSubject; topicId: string; retention: number }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const S = useSession(subj, topicId, retention, invalidate);
  const { s, topic, currentItem } = S;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/learn'));
  // Closing part-way through is allowed (the place is kept and offered again
  // from Today), but a stray tap on the cross should not end a lesson, so it
  // asks once. On the Done step there is nothing to lose.
  const [leaving, setLeaving] = useState(false);
  const close = () => (s.step === 'done' || (s.step === 'warm' && !s.warm) ? leave() : setLeaving(true));

  return (
    <Screen scroll width="reading">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" color="textMuted">
            {subj.plan.title}
          </Text>
          <Text variant="title">{topic.title}</Text>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <StepStrip S={S} />

      {leaving ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
          <Text variant="bodyStrong">Leave this lesson?</Text>
          <Text variant="body" color="textMuted">
            Your place is kept. It is offered again from Today, where you left off.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Button label="Keep going" onPress={() => setLeaving(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Leave" variant="secondary" onPress={leave} />
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl, flex: 1 }}>
        {s.error ? (
          <Notice tone="danger" text={s.error} />
        ) : null}

        {s.step === 'warm' ? <WarmStep S={S} /> : null}
        {s.step === 'learn' && s.lesson ? <LearnStep S={S} /> : null}
        {s.step === 'recall' ? <RecallStep S={S} /> : null}
        {s.step === 'drill' && s.lesson?.drill ? <DrillStep S={S} /> : null}
        {s.step === 'practice' ? <PracticeStep S={S} item={currentItem} /> : null}
        {s.step === 'roleplay' ? <RoleplayStep S={S} /> : null}
        {s.step === 'done' ? <DoneStep S={S} onClose={() => router.replace('/learn')} /> : null}
      </View>
    </Screen>
  );
}
