import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Logo, Screen, Text, TextField } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

const EXAMPLES = [
  'Conversational Spanish',
  'Public speaking',
  'Python for data analysis',
  'Personal finance',
];

// One question. Everything else is asked later, when it changes a decision.
export default function GoalScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const [goal, setGoal] = useState('');

  const start = () => {
    const subject = goal.trim();
    if (!subject) return;
    router.push({ pathname: '/place', params: { subject } });
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
        <Logo size={20} />
        <Text variant="caption" color="textMuted">
          to learn and to teach
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <Text variant="display">What do you want to learn, or become?</Text>

        <TextField
          label="Anything at all"
          value={goal}
          onChangeText={setGoal}
          placeholder="Spanish, public speaking, woodworking, data analysis"
          autoCapitalize="sentences"
          returnKeyType="go"
          onSubmitEditing={start}
        />

        <View style={{ gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            People start with
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {EXAMPLES.map((ex) => (
              <Pressable
                key={ex}
                onPress={() => setGoal(ex)}
                accessibilityRole="button"
                style={{
                  height: 36,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: 'center',
                }}
              >
                <Text variant="caption">{ex}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Button label="Start" onPress={start} disabled={!goal.trim()} />
        <Text variant="caption" color="textMuted" center>
          Ako is the Māori word for both learning and teaching.
        </Text>
      </View>
    </Screen>
  );
}
