import { View } from 'react-native';

import { Button, Screen, Text } from '@/src/components/ui';
import { useAuth } from '@/src/features/auth';
import { useProfile } from '@/src/features/profile';
import { useTheme } from '@/src/theme';

// Profile and settings. Reminders, voice, the profile import and roles
// arrive in later sessions; until then this page shows only what works.
export default function YouScreen() {
  const { spacing, colors } = useTheme();
  const { signOut, session } = useAuth();
  const { profile } = useProfile();

  return (
    <Screen scroll>
      <Text variant="title">You</Text>
      <View style={{ marginTop: spacing.xl }}>
        <Row label="Name" value={profile?.display_name || ''} />
        <Row label="Email" value={session?.user.email || ''} />
        <Row label="Review target" value={`${Math.round(Number(profile?.retention ?? 0.9) * 100)}% recall`} last />
      </View>
      <Text variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>
        Reminders, read-aloud and the profile import are on the way.
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}>
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { spacing, colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderColor: colors.border,
      }}
    >
      <Text variant="body" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}
