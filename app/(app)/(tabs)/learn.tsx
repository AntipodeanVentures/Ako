import { View } from 'react-native';

import { Button, EmptyState, Logo, Screen, Text } from '@/src/components/ui';
import { useSubjects } from '@/src/features/subjects';
import { useTheme } from '@/src/theme';

// The daily screen. Session 5 replaces the placeholder body with the
// session card sized to the slot and the subject cards with the ladder.
export default function LearnScreen() {
  const { spacing } = useTheme();
  const subjects = useSubjects();

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Logo size={20} />
        <Text variant="caption" color="textMuted">
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
      </View>

      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <Text variant="eyebrow" color="textMuted">
          Today
        </Text>
        <Text variant="figure">0 <Text variant="heading" color="textMuted">min</Text></Text>
        <Text variant="body">No reviews due. Start a subject to get your first session.</Text>
      </View>

      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        <Text variant="eyebrow" color="textMuted">
          Subjects
        </Text>
        {subjects.data?.length ? (
          subjects.data.map((s) => (
            <View key={s.id} style={{ paddingVertical: spacing.md }}>
              <Text variant="heading">{s.title}</Text>
            </View>
          ))
        ) : (
          <EmptyState title="Nothing yet" body="Add a subject or a role to begin." />
        )}
        <Button label="Add a subject or a role" variant="secondary" onPress={() => {}} />
      </View>
    </Screen>
  );
}
