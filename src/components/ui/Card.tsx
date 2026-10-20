import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { motion, useReducedMotion, useTheme } from '@/src/theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors, radius, spacing, elevation } = useTheme();
  const reduced = useReducedMotion();

  const cardStyle: ViewStyle[] = [
    {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.md,
    },
    elevation.card,
    style as ViewStyle,
  ];

  // Parents who ask the OS to reduce motion get a still, instant card.
  if (reduced) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <Animated.View
      // A gentle settle-in as the card mounts, so screens arrive calmly
      // rather than snapping into place.
      entering={FadeInDown.duration(motion.duration.base)}
      style={cardStyle}
    >
      {children}
    </Animated.View>
  );
}
