import { View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Avatar } from './Avatar';
import { Logo } from './Logo';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  // When set, a monogram avatar for this name appears on the left.
  avatarName?: string;
};

// The consistent header for the main tab screens: an optional
// monogram, the screen title, and the Ako mark on the right for a
// steady brand presence.
export function AppBar({ title, subtitle, avatarName }: Props) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md }}
      >
        {avatarName ? <Avatar name={avatarName} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="display">{title}</Text>
          {subtitle ? (
            <Text variant="body" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <Logo size={32} />
    </View>
  );
}
