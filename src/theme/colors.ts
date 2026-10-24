// Color palettes for Ako.
//
// The brand identity is an instrument panel: white ground, black ink, one
// green reserved for evidence (the ladder, progress, a secure topic).
// Feedback colours (success, warning, danger) appear only on feedback,
// never as decoration. Two modes: light and dark.

export type ThemeMode = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  accent: string;
  accentMuted: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
};

const light: Palette = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F6F7F8',
  border: '#E6E8EB',
  text: '#17191D',
  textMuted: '#5F646B',
  textInverse: '#FFFFFF',
  // Action is ink.
  primary: '#17191D',
  primaryMuted: '#EEF0F2',
  onPrimary: '#FFFFFF',
  // Evidence is green.
  accent: '#0B7A69',
  accentMuted: '#E2F1ED',
  success: '#0B7A69',
  warning: '#9A6B13',
  danger: '#B03A2E',
  overlay: 'rgba(23,25,29,0.5)',
};

// Dark mode: controls and cards sit one step above the ground, so a chip
// or a field reads as an object and not as a line drawn on the backdrop.
const dark: Palette = {
  background: '#17191D',
  surface: '#1C1F24',
  surfaceElevated: '#23272D',
  border: '#363B43',
  text: '#F2F3F5',
  textMuted: '#9AA0A8',
  textInverse: '#17191D',
  primary: '#F2F3F5',
  primaryMuted: '#2A2D33',
  onPrimary: '#17191D',
  accent: '#2FB59C',
  accentMuted: '#1E3630',
  success: '#2FB59C',
  warning: '#D9A441',
  danger: '#E0675B',
  overlay: 'rgba(0,0,0,0.65)',
};

export const palettes: Record<ThemeMode, Palette> = { light, dark };
