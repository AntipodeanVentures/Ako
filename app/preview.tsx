import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen, Text } from '@/src/components/ui';
import { makeCards } from '@/src/engine/scheduling';
import type { Plan } from '@/src/engine/types';
import { buildSubject, type LiveSubject } from '@/src/features/subjects';
import { planPortuguese } from '@/src/engine/fixtures';
import { seedBuildForPreview } from '@/src/features/subjects/planBuilder';
import { LearnView } from '@/src/screens/LearnView';
import { SubjectPath } from '@/src/screens/PathView';
import { useTheme } from '@/src/theme';

import PlaceScreen from './(onboarding)/place';
import GoalScreen from './(onboarding)/goal';

// Development only: the signed-in screens rendered from fixture data, so
// layout can be checked in a browser without an account. Not reachable in
// a production build.

function fixtureSubject(): LiveSubject {
  const plan = { v: 4, ...planPortuguese } as unknown as Plan;
  const day = new Date();
  day.setDate(day.getDate() - 3);
  const subj = buildSubject(
    {
      id: 'fixture',
      profile_id: 'me',
      title: plan.title,
      intake: { subject: 'Brazilian Portuguese', target: 's3', current: 'Know a little', hours: 2, minutes: 15 },
      plan,
      plan_version: 4,
      pitch: null,
      support: 'full',
      stats: { minutes: 85, lessonMinutes: 70, reviewMinutes: 15, lastStudied: Date.now() - 86400000, log: { [today()]: 12 } },
      model: null,
      role_area_id: null,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    null,
    [
      { subject_id: 'fixture', profile_id: 'me', topic_id: 'p1', status: 'mastered', correct: 5, misses: 0, relearn_days: [], jol: null, jol_actual: null, mastered_at: day.toISOString(), extra: {}, updated_at: '' },
      { subject_id: 'fixture', profile_id: 'me', topic_id: 'p2', status: 'mastered', correct: 5, misses: 1, relearn_days: [], jol: null, jol_actual: null, mastered_at: day.toISOString(), extra: {}, updated_at: '' },
    ],
    [],
    [],
  );
  const t = plan.topics[0];
  const cards = makeCards(t, [{ front: 'How is the nasal "ão" in "pão" made?', back: 'Air through the nose as the vowel glides; no hard n.', concept: 0 }], 3);
  cards[0].due = Date.now() - 1000;
  subj.cards = cards;
  return subj;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PreviewScreen() {
  const { screen, built, subject } = useLocalSearchParams<{ screen?: string; built?: string; subject?: string }>();
  const { spacing } = useTheme();
  const subj = useMemo(fixtureSubject, []);
  if (!__DEV__) return <Redirect href="/" />;

  if (screen === 'place') {
    if (built) {
      const plan = { v: 4, ...planPortuguese, title: subject || planPortuguese.title } as unknown as Plan;
      seedBuildForPreview({ subject: subject || 'Brazilian Portuguese', target: 's3', current: 'Know a little', hours: 2, minutes: 15, background: '', why: '' }, plan);
    }
    return <PlaceScreen />;
  }
  if (screen === 'goal') return <GoalScreen />;
  if (screen === 'path') {
    return (
      <Screen scroll>
        <SubjectPath subj={subj} onOpenTopic={() => {}} />
      </Screen>
    );
  }
  if (screen === 'empty') {
    return <LearnView subjects={[]} loading={false} onStart={() => {}} onOpenSubject={() => {}} onAddSubject={() => {}} />;
  }
  if (screen === 'learn') {
    return <LearnView subjects={[subj]} loading={false} onStart={() => {}} onOpenSubject={() => {}} onAddSubject={() => {}} />;
  }
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <Text variant="title">Preview</Text>
      <View style={{ gap: spacing.xs }}>
        {['learn', 'empty', 'path', 'goal', 'place'].map((s) => (
          <Text key={s} variant="body">
            /preview?screen={s}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
