import { Switch, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function SwitchRow({ label, description, value, onChange }: Props) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="caption" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
