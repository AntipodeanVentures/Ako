import { View } from 'react-native';

import { EmptyState, Screen, Text } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

// The ladder is the page. Session 7 builds it from engine/progress and
// engine/estimates.
export default function PathScreen() {
  const { spacing } = useTheme();
  return (
    <Screen scroll>
      <Text variant="title">Path</Text>
      <View style={{ marginTop: spacing.xl }}>
        <EmptyState title="No subject yet" body="Your levels, outcomes and expected dates appear here." />
      </View>
    </Screen>
  );
}
