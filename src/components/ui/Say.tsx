import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { canSpeak, speak, speakAll, stopSpeaking } from '@/src/features/speech';
import { useTheme } from '@/src/theme';

import { Text } from './Text';

// A small speaker beside a phrase: tap to hear it, tap again to stop. `locale` picks the voice
// ("pt-BR" for a Portuguese phrase; null for the device's English). Hidden where the device cannot speak.
type Props = {
  text: string | string[];
  locale?: string | null;
  // "Listen" with a label for a whole lesson; the bare icon beside a phrase otherwise.
  label?: string;
  size?: number;
};

export function Say({ text, locale = null, label, size = 18 }: Props) {
  const { colors, spacing, radius } = useTheme();
  const [on, setOn] = useState(false);
  useEffect(() => () => { if (on) stopSpeaking(); }, [on]);
  if (!canSpeak()) return null;
  const press = async () => {
    if (on) {
      stopSpeaking();
      setOn(false);
      return;
    }
    setOn(true);
    try {
      if (Array.isArray(text)) await speakAll(text, locale);
      else await speak(text, locale);
    } finally {
      setOn(false);
    }
  };
  const icon = <Ionicons name={on ? 'stop-circle-outline' : 'volume-medium-outline'} size={label ? 18 : size} color={on ? colors.text : colors.textMuted} />;
  if (label) {
    return (
      <Pressable
        onPress={() => void press()}
        accessibilityRole="button"
        accessibilityLabel={on ? 'Stop reading' : label}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}
      >
        {icon}
        <Text variant="caption" color={on ? 'text' : 'textMuted'}>
          {on ? 'Stop' : label}
        </Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={() => void press()} accessibilityRole="button" accessibilityLabel={on ? 'Stop' : 'Listen'} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
    </Pressable>
  );
}
