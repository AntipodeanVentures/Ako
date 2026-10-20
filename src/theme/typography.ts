import { type TextStyle } from 'react-native';

// Instrument Sans is the Ako typeface, for interface and lesson text
// alike. Each weight is a separate font family, loaded at startup in
// app/_layout.tsx. The keys here must match the family names passed to
// useFonts.
export const fontFamilies = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semiBold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
};

export const typography = {
  display: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  } as TextStyle,
  title: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
  } as TextStyle,
  heading: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
  } as TextStyle,
  // Questions and lesson prose: a size up from body so reading feels
  // different from acting.
  prose: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  } as TextStyle,
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 23,
  } as TextStyle,
  bodyStrong: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    lineHeight: 23,
  } as TextStyle,
  caption: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  // Small section labels: uppercase, tracked.
  eyebrow: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as TextStyle,
  // The one number that matters on a screen: minutes today, a percentage.
  figure: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  figureSmall: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};

export type TypographyVariant = keyof typeof typography;
