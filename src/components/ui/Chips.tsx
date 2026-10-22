import { Pressable, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  // Several may be picked at once; the default is one.
  multi?: boolean;
};

// Quick answers to a question: short labels that wrap, sized to their
// text. A picked chip is ink on white, like a selected segment. Use this
// where the answers are the model's suggestions and the learner may also
// type their own; use Segmented for a fixed set of equal choices.
export function Chips({ options, value, onChange, multi = false }: Props) {
  const { colors, radius, spacing } = useTheme();
  const toggle = (opt: string) => {
    const picked = value.includes(opt);
    if (multi) onChange(picked ? value.filter((v) => v !== opt) : [...value, opt]);
    else onChange(picked ? [] : [opt]);
  };
  return (
    <View accessibilityRole={multi ? undefined : 'radiogroup'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => {
        const selected = value.includes(opt);
        return (
          <Pressable
            key={opt}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: selected } : { selected }}
            onPress={() => toggle(opt)}
            style={({ pressed }) => ({
              minHeight: 40,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : colors.surface,
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="caption" color={selected ? 'onPrimary' : 'text'}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
