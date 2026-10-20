import { Pressable, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

export type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type Props<T extends string> = {
  label?: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.value)}
              style={{
                backgroundColor: selected ? colors.primaryMuted : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.lg,
                gap: 2,
              }}
            >
              <Text variant="bodyStrong" color={selected ? 'primary' : 'text'}>
                {opt.label}
              </Text>
              {opt.description ? (
                <Text variant="caption" color="textMuted">
                  {opt.description}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
