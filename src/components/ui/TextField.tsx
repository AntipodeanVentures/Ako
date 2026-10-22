import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  error?: string;
  // 'question' sets the label in body weight above the field, for a
  // sentence-long prompt rather than a one-word field name.
  labelVariant?: 'caption' | 'question';
};

export function TextField({ label, error, labelVariant = 'caption', style, onFocus, onBlur, ...rest }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : colors.border;

  return (
    <View style={{ gap: labelVariant === 'question' ? spacing.sm : spacing.xs }}>
      <Text variant={labelVariant === 'question' ? 'bodyStrong' : 'caption'} color={labelVariant === 'question' ? 'text' : 'textMuted'}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            color: colors.text,
            fontFamily: typography.body.fontFamily,
            fontSize: typography.body.fontSize,
            minHeight: 52,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
