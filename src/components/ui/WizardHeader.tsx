import { View } from 'react-native';

import { useTheme } from '@/src/theme';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

const TOTAL_STEPS = 5;

type Props = {
  step: number;
  title: string;
  subtitle?: string;
};

// The header for an assessment step: a progress bar, the step count, the
// title, and an optional line of guidance. Gives the wizard a clear,
// paced sense of how far along you are.
export function WizardHeader({ step, title, subtitle }: Props) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <ProgressBar value={step / TOTAL_STEPS} />
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" color="textMuted">
          Step {step} of {TOTAL_STEPS}
        </Text>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="body" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
