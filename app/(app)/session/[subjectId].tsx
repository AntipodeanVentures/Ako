import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Screen, Text } from '@/src/components/ui';
import { useProfile } from '@/src/features/profile';
import { useSession } from '@/src/features/session/useSession';
import { useInvalidateSubject, useLiveSubjects, type LiveSubject } from '@/src/features/subjects';
import { DoneStep, DrillStep, LearnStep, Notice, PracticeStep, RecallStep, RoleplayStep, StepStrip, TeachStep, WarmStep } from '@/src/screens/SessionSteps';
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
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator /> : <Text color="textMuted">Subject not found.</Text>}
        </View>
      </Screen>
    );
  }
  const tid = topicId || live.plan.topics[0]?.id;
  if (!tid) return null;
  return <SessionScreen subj={live} topicId={tid} retention={Number(profile?.retention ?? 0.9)} />;
}

function SessionScreen({ subj, topicId, retention }: { subj: LiveSubject; topicId: string; retention: number }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const S = useSession(subj, topicId, retention, invalidate);
  const { s, topic, currentItem } = S;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

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

      <View style={{ marginTop: spacing.xl, flex: 1 }}>
        {s.error ? (
          <Notice tone="danger" text={s.error} />
        ) : null}

        {s.step === 'warm' ? <WarmStep S={S} /> : null}
        {s.step === 'learn' && s.lesson ? <LearnStep S={S} /> : null}
        {s.step === 'recall' ? <RecallStep S={S} /> : null}
        {s.step === 'drill' && s.lesson?.drill ? <DrillStep S={S} /> : null}
        {s.step === 'practice' ? <PracticeStep S={S} item={currentItem} /> : null}
        {s.step === 'teach' ? <TeachStep S={S} /> : null}
        {s.step === 'roleplay' ? <RoleplayStep S={S} /> : null}
        {s.step === 'done' ? <DoneStep S={S} onClose={() => router.replace('/learn')} /> : null}
      </View>
    </Screen>
  );
}
