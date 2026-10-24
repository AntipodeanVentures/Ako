import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

// A phone browser in "Desktop site" mode lays the page out at laptop width
// and shrinks it to fit, so the type is half size and the column a third
// of the screen. Chrome and Samsung Internet remember the setting per
// site, so a learner can be stuck in it without knowing why the app looks
// wrong. Say so at the top, scaled up enough to be read at that zoom.
const PHONE_WIDTH = 412;

function desktopScale(): number {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return 0;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const tall = window.innerHeight / Math.max(1, window.innerWidth) >= 1.5;
  if (!coarse || !tall || window.innerWidth < 800) return 0;
  return Math.min(3, window.innerWidth / PHONE_WIDTH);
}

export function DesktopModeNotice() {
  const { colors, spacing, typography } = useTheme();
  const [scale, setScale] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const check = () => setScale(desktopScale());
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!scale || dismissed) return null;
  const k = scale;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl * k,
        paddingVertical: spacing.md * k,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg * k,
      }}
    >
      <Text
        color="onPrimary"
        style={{ flex: 1, fontFamily: typography.body.fontFamily, fontSize: 14 * k, lineHeight: 19 * k }}
      >
        {'This browser is showing the desktop version, so Ako looks small. In the browser menu, turn off "Desktop site", then open Ako again.'}
      </Text>
      <Pressable onPress={() => setDismissed(true)} accessibilityRole="button" hitSlop={12}>
        <Text color="onPrimary" style={{ fontFamily: typography.bodyStrong.fontFamily, fontSize: 14 * k }}>
          Dismiss
        </Text>
      </Pressable>
    </View>
  );
}
