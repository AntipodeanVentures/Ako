import { View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  // The baby's name; the first letter becomes the monogram.
  name: string;
  size?: number;
};

// A simple monogram avatar in a gold-ringed disc, so the app feels like
// it belongs to this baby without needing photo upload infrastructure.
export function Avatar({ name, size = 44 }: Props) {
  const { colors } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryMuted,
        borderWidth: 2,
        borderColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="heading" color="primary">
        {initial}
      </Text>
    </View>
  );
}
