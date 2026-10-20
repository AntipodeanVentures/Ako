import { View } from 'react-native';

import { Button, ListGroup, ListRow, Screen, Text } from '@/src/components/ui';
import { useAuth } from '@/src/features/auth';
import { useProfile } from '@/src/features/profile';
import { useTheme } from '@/src/theme';

// Profile, roles and settings. Session 7 fills the profile items and the
// role readiness map.
export default function YouScreen() {
  const { spacing } = useTheme();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  return (
    <Screen scroll>
      <Text variant="title">You</Text>
      <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
        <ListGroup>
          <ListRow label="Reminders" value={profile?.reminder_time ?? 'Off'} onPress={() => {}} />
          <ListRow label="Voice" value={profile?.voice_on ? 'On' : 'Off'} onPress={() => {}} />
          <ListRow label="Study plan" value={profile?.study_plan?.time ?? 'Not set'} onPress={() => {}} />
          <ListRow label="Your data" value="Export or delete" onPress={() => {}} />
        </ListGroup>
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
