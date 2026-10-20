import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type Palette, type ThemeMode } from './colors';
import { elevationFor, type ElevationLevel } from './elevation';
import { radius, spacing } from './spacing';
import { typography } from './typography';
import type { ViewStyle } from 'react-native';

export type ThemePreference = 'system' | ThemeMode;

type ThemeContextValue = {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: Record<ElevationLevel, ViewStyle>;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'ako.theme.preference';

export function ThemeProvider({
  children,
  forceMode,
}: {
  children: ReactNode;
  // Pins this part of the tree to a fixed mode, ignoring the user's
  // preference. Used to give the settling screen a calm, dark canvas.
  forceMode?: ThemeMode;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) setPreferenceState(stored as ThemePreference);
    });
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const resolved: ThemeMode =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;
  const mode: ThemeMode = forceMode ?? resolved;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      preference,
      colors: palettes[mode],
      spacing,
      radius,
      typography,
      elevation: elevationFor(mode),
      setPreference,
    }),
    [mode, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
