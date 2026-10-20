import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue } from 'react-native';

import { useTheme } from '@/src/theme';
import { Card } from './Card';

type Props = {
  width?: DimensionValue;
  height: number;
  radius?: number;
};

// A gently pulsing placeholder block, shown while real content loads.
export function Skeleton({ width = '100%', height, radius = 8 }: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.primaryMuted,
        opacity,
      }}
    />
  );
}

// A card-shaped skeleton, matching the rhythm of a real content card.
export function SkeletonCard() {
  return (
    <Card>
      <Skeleton width="50%" height={13} />
      <Skeleton width="78%" height={22} />
      <Skeleton height={13} />
      <Skeleton width="64%" height={13} />
    </Card>
  );
}
