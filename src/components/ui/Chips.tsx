import { Pressable, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  // Several may be picked at once; the default is one.
  multi?: boolean;
  // The option that opens a free-text answer ("Something else"). Drawn
  // with a dashed edge and quieter text, so it reads as "write your own"
  // rather than as one more answer.
  other?: string;
};

// Quick answers to a question: short labels that wrap, sized to their
// text. A picked chip is outlined in ink on the muted fill, like a selected segment. Use this
// where the answers are the model's suggestions and the learner may also
// type their own; use Segmented for a fixed set of equal choices.
export function Chips({ options, value, onChange, multi = false, other }: Props) {
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
        const isOther = other !== undefined && opt === other;
        return (
          <Pressable
            key={opt}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: selected } : { selected }}
            onPress={() => toggle(opt)}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderStyle: isOther && !selected ? 'dashed' : 'solid',
              borderColor: selected ? colors.text : colors.border,
              backgroundColor: selected ? colors.primaryMuted : isOther ? 'transparent' : colors.surface,
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant={selected ? 'bodyStrong' : 'caption'} color={isOther && !selected ? 'textMuted' : 'text'} style={selected ? { fontSize: 13, lineHeight: 18 } : undefined}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
