import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
};

const POINTS = [1, 2, 3, 4, 5];

export function Scale({ label, value, onChange, minLabel, maxLabel }: Props) {
  const { colors, radius, spacing } = useTheme();

  const select = (point: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(point);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {POINTS.map((point) => {
          const selected = point === value;
          return (
            <Pressable
              key={point}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${point} of 5`}
              onPress={() => select(point)}
              style={{
                flex: 1,
                height: 52,
                borderRadius: radius.md,
                backgroundColor: selected ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="heading" color={selected ? 'onPrimary' : 'text'}>
                {point}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textMuted">
          {minLabel}
        </Text>
        <Text variant="caption" color="textMuted">
          {maxLabel}
        </Text>
      </View>
    </View>
  );
}
