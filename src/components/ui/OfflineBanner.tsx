import { View } from 'react-native';

import { useIsOnline } from '@/src/lib/network';
import { useTheme } from '@/src/theme';
import { Text } from './Text';

// One line at the top while the connection is gone. Reviews and reading
// still work; anything that needs the tutor waits, and the app says so
// rather than failing quietly.
export function OfflineBanner() {
  const online = useIsOnline();
  const { colors, spacing } = useTheme();
  if (online) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, alignItems: 'center' }}>
      <Text variant="caption" color="textMuted">
        You are offline. Reviews still work; new lessons and marking wait for the connection.
      </Text>
    </View>
  );
}
