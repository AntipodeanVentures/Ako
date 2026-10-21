import { Pressable, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

export type Segment<T extends string> = {
  value: T;
  label: string;
  // Shown under the row while this segment is selected.
  hint?: string;
};

type Props<T extends string> = {
  options: Segment<T>[];
  value: T | null;
  onChange: (value: T) => void;
  // Wraps onto a second row when there are many options; the default
  // keeps them on one line in equal cells.
  wrap?: boolean;
};

// A row of equal cells for one choice among a few. The selected cell is
// ink on white; nothing else moves. Use this for short labels (a level,
// a number of minutes); use OptionGroup when each option needs a sentence.
export function Segmented<T extends string>({ options, value, onChange, wrap = false }: Props<T>) {
  const { colors, radius, spacing } = useTheme();
  const hint = options.find((o) => o.value === value)?.hint;

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        accessibilityRole="radiogroup"
        style={{
          flexDirection: 'row',
          flexWrap: wrap ? 'wrap' : 'nowrap',
          gap: spacing.sm,
        }}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: wrap ? '45%' : 0,
                minHeight: 44,
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary : colors.surface,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                variant="caption"
                color={selected ? 'onPrimary' : 'text'}
                center
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
