import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { motion, useReducedMotion, useTheme } from '@/src/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  // Fill fraction from 0 to 1.
  progress: number;
  size?: number;
  stroke?: number;
  tone?: 'primary' | 'accent';
  children?: ReactNode;
};

// A circular progress arc that sweeps to its value on mount, with a label
// in the centre. Used for headline metrics. Unlike the settling
// CountdownRing it does not breathe; it is a calm, single fill.
export function ProgressRing({
  progress,
  size = 132,
  stroke = 12,
  tone = 'primary',
  children,
}: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    fill.value = reduced
      ? clamped
      : withTiming(clamped, {
          duration: motion.duration.slow,
          easing: motion.easing.standard,
        });
  }, [clamped, reduced, fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.primaryMuted}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={tone === 'accent' ? colors.accent : colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children}
    </View>
  );
}
