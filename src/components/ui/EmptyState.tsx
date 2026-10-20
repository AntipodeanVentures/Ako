import { View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

// A quiet placeholder for a screen or section with no content yet: a
// short heading, a line of guidance, and an optional action. No
// illustration; the instrument look does not decorate empty space.
export function EmptyState({ title, body, action }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text variant="heading">{title}</Text>
        <Text variant="body" color="textMuted">
          {body}
        </Text>
      </View>
      {action ? (
        <Button label={action.label} onPress={action.onPress} fullWidth={false} variant="secondary" />
      ) : null}
    </View>
  );
}
