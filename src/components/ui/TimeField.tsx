import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
};

// Picks the time of day for an event. The date portion of `value` is
// preserved, so callers typically pass a Date initialised to "now".
export function TimeField({ label, value, onChange }: Props) {
  const { colors, radius, spacing } = useTheme();
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'set' && date) onChange(date);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setShow(true)}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          minHeight: 52,
          justifyContent: 'center',
        }}
      >
        <Text variant="body">
          {value.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </Pressable>
      {show ? (
        <View style={{ gap: spacing.sm }}>
          <DateTimePicker
            value={value}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Button
              label="Done"
              variant="secondary"
              onPress={() => setShow(false)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
