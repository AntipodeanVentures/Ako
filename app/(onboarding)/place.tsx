import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, OptionGroup, Screen, Text } from '@/src/components/ui';
import { START_LEVELS } from '@/src/engine/ladder';
import { useTheme } from '@/src/theme';

type StartLevel = (typeof START_LEVELS)[number];

const SLOTS = [5, 15, 30, 45] as const;

// Two taps while the plan starts building: where you are, and how much
// time most days. The optional profile import comes after the first
// session, not before it.
export default function PlaceScreen() {
  const { spacing } = useTheme();
  const router = useRouter();
  const { subject } = useLocalSearchParams<{ subject: string }>();
  const [current, setCurrent] = useState<StartLevel>('Know a little');
  const [minutes, setMinutes] = useState<number>(15);

  const go = () => {
    // Session 5 wires this to the `plan` function and the first warm-up.
    router.replace('/learn');
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing.xs }}>
        <Text variant="eyebrow" color="textMuted">
          Your path
        </Text>
        <Text variant="title">{subject}</Text>
      </View>

      <View style={{ gap: spacing.xl, marginTop: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">Where are you now?</Text>
          <OptionGroup
            options={START_LEVELS.map((l) => ({ value: l, label: l }))}
            value={current}
            onChange={(v) => setCurrent(v as StartLevel)}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">Time on most days?</Text>
          <OptionGroup
            options={SLOTS.map((m) => ({ value: String(m), label: `${m} min` }))}
            value={String(minutes)}
            onChange={(v) => setMinutes(Number(v))}
          />
        </View>
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ gap: spacing.md }}>
        <Button label="Ask me my first question" onPress={go} />
        <Text variant="caption" color="textMuted" center>
          The rest of the path finishes while you answer.
        </Text>
      </View>
    </Screen>
  );
}
