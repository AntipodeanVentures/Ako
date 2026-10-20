import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function Stepper({ label, value, onChange, min = 0, max = 30 }: Props) {
  const { colors, radius, spacing } = useTheme();

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };

  const renderButton = (symbol: string, delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Increase' : 'Decrease'} ${label}`}
      disabled={disabled}
      onPress={() => step(delta)}
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text variant="title" color="text">
        {symbol}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        {renderButton('−', -1, value <= min)}
        <Text
          variant="heading"
          style={{ minWidth: 32, textAlign: 'center' }}
        >
          {value}
        </Text>
        {renderButton('+', 1, value >= max)}
      </View>
    </View>
  );
}
