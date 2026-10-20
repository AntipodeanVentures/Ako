import { useEffect, useId, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { motion, useReducedMotion, useTheme } from '@/src/theme';

type Props = {
  // Completion fraction from 0 (just started) to 1 (finished).
  progress: number;
  size?: number;
  children?: ReactNode;
};

export function CountdownRing({ progress, size = 260, children }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const glowId = useId();
  const strokeId = useId();
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const center = size / 2;

  // A slow, calm breathing pulse, paced to a relaxed breath. It gives the
  // settling screen a living, soothing quality rather than a static dial.
  // Held still for parents who have asked the OS to reduce motion.
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    breathe.value = withRepeat(
      withTiming(1, {
        duration: motion.duration.breath,
        easing: motion.easing.gentle,
      }),
      -1,
      true,
    );
  }, [breathe, reduced]);
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.035 }],
  }));

  // A soft halo extends a little beyond the ring, so it reads as a gentle
  // light in the dark rather than a hard dial.
  const glowPad = stroke * 2.4;
  const glowSize = size + glowPad * 2;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        breatheStyle,
      ]}
    >
      <Svg
        width={glowSize}
        height={glowSize}
        style={{ position: 'absolute', top: -glowPad, left: -glowPad }}
      >
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0.6" stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={glowSize / 2}
          cy={glowSize / 2}
          r={glowSize / 2}
          fill={`url(#${glowId})`}
        />
      </Svg>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={strokeId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.accent} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.primaryMuted}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${strokeId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * clamped}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children}
    </Animated.View>
  );
}
