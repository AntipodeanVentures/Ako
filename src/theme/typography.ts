import { Platform, type TextStyle } from 'react-native';

// Instrument Sans is the Ako typeface, for interface and lesson text
// alike. Each weight is a separate font family, loaded at startup in
// app/_layout.tsx. The names here must match the family names passed to
// useFonts.
//
// On the web the family is a stack: if the font files do not arrive (a
// slow or flaky connection, a blocked request), the browser falls back to
// the system sans-serif instead of its default serif. The matching
// fontWeight gives the fallback the right weight; app/+html.tsx turns off
// font synthesis so the real files, which are registered at normal weight,
// are not faux-bolded.
const FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const family = (name: string) => (Platform.OS === 'web' ? `${name}, ${FALLBACK}` : name);

export const fontFamilies = {
  regular: family('InstrumentSans_400Regular'),
  medium: family('InstrumentSans_500Medium'),
  semiBold: family('InstrumentSans_600SemiBold'),
  bold: family('InstrumentSans_700Bold'),
};

const weight = (w: TextStyle['fontWeight']): TextStyle => (Platform.OS === 'web' ? { fontWeight: w } : {});

export const typography = {
  display: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  } as TextStyle,
  title: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
  } as TextStyle,
  heading: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
  } as TextStyle,
  // Lesson section headings: a clear step above body, below the title.
  subtitle: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  } as TextStyle,
  // The opening paragraph of a lesson: read, not shouted. A size up from body, regular weight.
  lead: {
    fontFamily: fontFamilies.regular,
    ...weight('400'),
    fontSize: 18,
    lineHeight: 27,
  } as TextStyle,
  // Questions: a size up from body so reading a question feels different from reading a lesson.
  prose: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  } as TextStyle,
  body: {
    fontFamily: fontFamilies.regular,
    ...weight('400'),
    fontSize: 16,
    lineHeight: 23,
  } as TextStyle,
  bodyStrong: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 16,
    lineHeight: 23,
  } as TextStyle,
  caption: {
    fontFamily: fontFamilies.medium,
    ...weight('500'),
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  // Small section labels: uppercase, tracked.
  eyebrow: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as TextStyle,
  // The one number that matters on a screen: minutes today, a percentage.
  figure: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  figureSmall: {
    fontFamily: fontFamilies.semiBold,
    ...weight('600'),
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};

export type TypographyVariant = keyof typeof typography;
