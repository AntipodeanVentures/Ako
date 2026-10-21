import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Logo, Screen, Text, TextField } from '@/src/components/ui';
import { useSubjects } from '@/src/features/subjects';
import { useTheme } from '@/src/theme';

const EXAMPLES = [
  'Conversational Spanish',
  'Public speaking',
  'Python for data analysis',
  'Personal finance',
  'Brazilian jiu-jitsu',
  'Wine',
];

// One question. Everything else is asked when it changes a decision.
export default function GoalScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const subjects = useSubjects();
  const [goal, setGoal] = useState('');
  const hasSubjects = Boolean(subjects.data?.length);

  const start = () => {
    const subject = goal.trim();
    if (!subject) return;
    router.push({ pathname: '/place', params: { subject } });
  };

  return (
    <Screen scroll width="narrow">
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xxl }}>
        <View style={{ alignItems: 'center', gap: spacing.xl }}>
          <Logo size={28} />
          <Text variant="display" center>
            What do you want to learn, or become?
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          <TextField
            label="Anything at all"
            value={goal}
            onChangeText={setGoal}
            placeholder="Spanish, woodworking, data analysis"
            autoCapitalize="sentences"
            returnKeyType="go"
            onSubmitEditing={start}
            autoFocus
          />
          <Button label="Start" onPress={start} disabled={!goal.trim()} />
        </View>

        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <Text variant="eyebrow" color="textMuted">
            People start with
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            {EXAMPLES.map((ex) => (
              <Pressable
                key={ex}
                onPress={() => setGoal(ex)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  height: 36,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                  justifyContent: 'center',
                })}
              >
                <Text variant="caption">{ex}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {hasSubjects ? (
          <Pressable onPress={() => router.replace('/learn')} style={{ alignSelf: 'center' }}>
            <Text variant="bodyStrong">Back to today</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
