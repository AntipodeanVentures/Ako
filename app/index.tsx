import { ActivityIndicator, View } from 'react-native';

import { Logo, Screen, Text } from '@/src/components/ui';
import { useAuth } from '@/src/features/auth';
import { useTheme } from '@/src/theme';

// Transient landing route. The route guard in the root layout redirects
// away from here once the session and profile states have resolved.
export default function SplashRoute() {
  const { colors, spacing } = useTheme();
  const { configured } = useAuth();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl }}>
        <Logo size={40} />
        {configured ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text variant="body" color="textMuted" center>
            Supabase isn&apos;t configured yet. Copy .env.example to .env, add
            your project URL and anon key, then restart the app.
          </Text>
        )}
      </View>
    </Screen>
  );
}
