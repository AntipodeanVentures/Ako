import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type Palette, type TypographyVariant } from '@/src/theme';

type Props = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof Palette;
  center?: boolean;
};

export function Text({
  variant = 'body',
  color = 'text',
  center,
  style,
  ...rest
}: Props) {
  const { typography, colors } = useTheme();
  return (
    <RNText
      style={[
        typography[variant],
        { color: colors[color] },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}
