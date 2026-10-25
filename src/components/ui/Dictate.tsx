import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { useDictation } from '@/src/features/speech/useDictation';
import { useTheme } from '@/src/theme';

import { Text } from './Text';

// "Speak instead": a microphone under an answer field. What is heard is appended to the field as it arrives;
// a second tap stops. Shown only where the browser can recognise speech.
type Props = {
  value: string;
  onChangeText: (text: string) => void;
  lang?: string | null;
};

export function Dictate({ value, onChangeText, lang }: Props) {
  const { colors, spacing } = useTheme();
  // The field's text when dictation started, so interim results replace each other rather than pile up.
  const base = useRef('');
  const d = useDictation((text) => {
    const sep = base.current && !/\s$/.test(base.current) ? ' ' : '';
    onChangeText(base.current + sep + text);
  }, lang ?? 'en-GB');
  if (!d.supported) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Pressable
        onPress={() => {
          if (d.listening) d.stop();
          else {
            base.current = value;
            d.start();
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={d.listening ? 'Stop listening' : 'Speak your answer'}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, opacity: pressed ? 0.7 : 1 })}
      >
        <Ionicons name={d.listening ? 'mic' : 'mic-outline'} size={18} color={d.listening ? colors.danger : colors.textMuted} />
        <Text variant="caption" color={d.listening ? 'danger' : 'textMuted'}>
          {d.listening ? 'Listening, tap to stop' : 'Speak instead'}
        </Text>
      </Pressable>
      {d.error ? (
        <Text variant="caption" color="textMuted">
          {d.error}
        </Text>
      ) : null}
    </View>
  );
}
