import { Platform, type ViewStyle } from 'react-native';

import type { ThemeMode } from './colors';

export type ElevationLevel = 'card' | 'raised';

// A soft shadow. Light mode leans on shadows for depth; dark mode
// conveys depth through lighter elevated surfaces instead, since a
// shadow is all but invisible on a dark background.
function shadow(
  opacity: number,
  radius: number,
  offsetY: number,
  android: number,
): ViewStyle {
  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#0B0B1A',
        shadowOpacity: opacity,
        shadowRadius: radius,
        shadowOffset: { width: 0, height: offsetY },
      },
      android: { elevation: android },
      default: {},
    }) ?? {}
  );
}

const flat: Record<ElevationLevel, ViewStyle> = { card: {}, raised: {} };

export function elevationFor(mode: ThemeMode): Record<ElevationLevel, ViewStyle> {
  if (mode !== 'light') return flat;
  return {
    // Cards are drawn with a hairline border, not a shadow.
    card: {},
    raised: shadow(0.12, 20, 8, 8),
  };
}
