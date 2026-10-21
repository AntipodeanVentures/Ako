import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, EmptyState, Screen, Segmented, Text } from '@/src/components/ui';
import { useProfile } from '@/src/features/profile';
import { useLiveSubjects } from '@/src/features/subjects';
import { SubjectPath } from '@/src/screens/PathView';
import { useTheme } from '@/src/theme';

// The ladder is the page: where you stand, what the next level means for
// this subject, when it is expected, and every topic with its state.
export default function PathScreen() {
  const { spacing } = useTheme();
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const [picked, setPicked] = useState<string | null>(null);
  const subj = subjects.find((s) => s.id === (picked || subjectId)) || subjects[0];

  if (!loading && !subj) {
    return (
      <Screen scroll>
        <Text variant="title">Path</Text>
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState title="No subject yet" body="Your levels, outcomes and expected dates appear here." />
          <View style={{ marginTop: spacing.lg }}>
            <Button label="Add a subject" onPress={() => router.push('/goal')} />
          </View>
        </View>
      </Screen>
    );
  }
  if (!subj) {
    return (
      <Screen>
        <View />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {subjects.length > 1 ? (
        <View style={{ marginBottom: spacing.xl }}>
          <Segmented
            options={subjects.map((s) => ({ value: s.id, label: s.plan.title }))}
            value={subj.id}
            onChange={setPicked}
            wrap={subjects.length > 3}
          />
        </View>
      ) : null}
      <SubjectPath subj={subj} />
    </Screen>
  );
}
