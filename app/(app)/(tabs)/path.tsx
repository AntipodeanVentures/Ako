import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, EmptyState, Screen, Skeleton, Text } from '@/src/components/ui';
import { useProfile } from '@/src/features/profile';
import { useLiveSubjects } from '@/src/features/subjects';
import { liveSubjects } from '@/src/features/subjects/summary';
import { SubjectPath } from '@/src/screens/PathView';
import { useTheme } from '@/src/theme';

// The ladder is the page: where you stand, what the next level means for
// this subject, when it is expected, and every topic with its state.
export default function PathScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const { profile } = useProfile();
  const all = useLiveSubjects(profile);
  const subjects = liveSubjects(all.subjects);
  const loading = all.loading;
  const [picked, setPicked] = useState<string | null>(null);
  // A subject opened from elsewhere wins over the chip last tapped here.
  useEffect(() => {
    if (subjectId) setPicked(subjectId);
  }, [subjectId]);
  const subj = subjects.find((s) => s.id === picked) || subjects[0];

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
      <Screen scroll>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={30} width="60%" />
          <Skeleton height={8} />
          <Skeleton height={22} width="40%" />
          <Skeleton height={60} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {subjects.length > 1 ? (
        // Subject titles are long, so the switcher is a row of chips sized
        // to their text that scrolls sideways, rather than equal cells that
        // would cut every title short.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -spacing.xl, marginBottom: spacing.xl, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
        >
          {subjects.map((s) => {
            const selected = s.id === subj.id;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setPicked(s.id)}
                style={({ pressed }) => ({
                  minHeight: 40,
                  paddingHorizontal: spacing.lg,
                  justifyContent: 'center',
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : colors.surface,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text variant="caption" color={selected ? 'onPrimary' : 'text'} numberOfLines={1}>
                  {s.plan.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <SubjectPath subj={subj} />
    </Screen>
  );
}
