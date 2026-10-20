import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { motion, useReducedMotion, useTheme } from '@/src/theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Props = {
  // Bar values, oldest first.
  data: number[];
  // Optional dashed horizontal reference line (e.g. a baseline average).
  referenceValue?: number;
  height?: number;
};

// A single bar that grows up from the baseline as the chart animates in.
function Bar({
  x,
  width,
  baseY,
  fullHeight,
  hasValue,
  fill,
  grow,
}: {
  x: number;
  width: number;
  baseY: number;
  fullHeight: number;
  hasValue: boolean;
  fill: string;
  grow: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const h = fullHeight * grow.value;
    return { height: Math.max(h, hasValue ? 2 : 0), y: baseY - h };
  });
  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={width / 2.4}
      fill={fill}
      animatedProps={animatedProps}
    />
  );
}

export function BarChart({ data, referenceValue, height = 160 }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const grow = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      grow.value = 1;
      return;
    }
    grow.value = 0;
    grow.value = withTiming(1, {
      duration: motion.duration.slow,
      easing: motion.easing.standard,
    });
  }, [grow, data.length, width, reduced]);

  const max = Math.max(1, ...data, referenceValue ?? 0);
  const padding = 4;
  const usableHeight = height - padding * 2;
  const baseY = padding + usableHeight;
  const referenceY =
    referenceValue != null && referenceValue > 0
      ? baseY - (referenceValue / max) * usableHeight
      : null;
  const lastIndex = data.length - 1;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height }}
    >
      {width > 0 && data.length > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="barPrimary" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0.55} />
            </LinearGradient>
            <LinearGradient id="barAccent" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0.6} />
            </LinearGradient>
          </Defs>
          {data.map((value, index) => {
            const slot = width / data.length;
            const barWidth = slot * 0.64;
            return (
              <Bar
                key={index}
                x={index * slot + (slot - barWidth) / 2}
                width={barWidth}
                baseY={baseY}
                fullHeight={(value / max) * usableHeight}
                hasValue={value > 0}
                // The most recent day is picked out in the gold accent.
                fill={index === lastIndex ? 'url(#barAccent)' : 'url(#barPrimary)'}
                grow={grow}
              />
            );
          })}
          {referenceY != null ? (
            <Line
              x1={0}
              x2={width}
              y1={referenceY}
              y2={referenceY}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray="5 4"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
