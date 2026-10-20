import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, useReducedMotion, useTheme } from '@/src/theme';

type Props = {
  // Completion fraction from 0 to 1.
  value: number;
  // The fill colour: the brand primary by default, or the gold accent
  // for celebratory or milestone progress.
  tone?: 'primary' | 'accent';
};

export function ProgressBar({ value, tone = 'primary' }: Props) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const fill = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    fill.value = reduced
      ? clamped
      : withTiming(clamped, {
          duration: motion.duration.slow,
          easing: motion.easing.standard,
        });
  }, [clamped, reduced, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      style={{
        height: 8,
        borderRadius: radius.pill,
        backgroundColor: colors.primaryMuted,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: tone === 'accent' ? colors.accent : colors.primary,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
