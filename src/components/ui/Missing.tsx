import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Button } from './Button';
import { Screen } from './Screen';
import { Text } from './Text';

type Props = {
  // Still fetching: a spinner, nothing else, so the message never flashes
  // before the data arrives.
  loading?: boolean;
  title: string;
  body: string;
};

// A whole screen for a thing that is not there: a subject or topic opened
// from a stale link, or deleted on another device. Always a way back, so
// the learner is never left on a blank page.
export function Missing({ loading, title, body }: Props) {
  const { spacing } = useTheme();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/map'));
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <View style={{ gap: spacing.md, alignItems: 'center', maxWidth: 360 }}>
            <Text variant="heading" center>
              {title}
            </Text>
            <Text variant="body" color="textMuted" center>
              {body}
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <Button label="Back to today" variant="secondary" onPress={back} fullWidth={false} />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}
