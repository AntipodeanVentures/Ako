import { View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  // Point size of the wordmark.
  size?: number;
  // Kept for call-site compatibility with the Thrive kit; the Ako mark
  // is the wordmark itself.
  showWordmark?: boolean;
  color?: string;
};

// The Ako mark is the word, set tight in the brand weight. No icon,
// no illustration: the product is the instrument, not the mascot.
export function Logo({ size = 24, color }: Props) {
  const { colors, typography } = useTheme();
  return (
    <View accessibilityRole="image" accessibilityLabel="Ako">
      <Text
        style={[
          typography.title,
          {
            fontSize: size,
            lineHeight: Math.round(size * 1.1),
            letterSpacing: -size * 0.04,
            color: color ?? colors.text,
          },
        ]}
      >
        ako
      </Text>
    </View>
  );
}
