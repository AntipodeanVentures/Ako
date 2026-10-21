import { View } from 'react-native';

import { STAGES } from '@/src/engine/ladder';
import { useTheme } from '@/src/theme';
import { Text } from './Text';

type Props = {
  // Index of the highest stage reached, -1 for none.
  reached: number;
  // Index of the stage being worked on and how much of it is learned (0 to 1).
  current: number;
  progress: number;
  // Show the stage names under the bars.
  labels?: boolean;
  // Short markers under the names (CEFR bands, belts), one per stage.
  markers?: (string | null | undefined)[];
  height?: number;
};

// Five bars, one per stage. Reached stages are solid green, the current
// one fills from the left, the rest are hairlines. The only place the
// brand green appears is here and in other evidence.
export function Ladder({ reached, current, progress, labels = false, markers, height = 6 }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {STAGES.map((s, i) => {
          const full = i <= reached;
          const part = i === current && !full ? Math.max(0, Math.min(1, progress)) : 0;
          return (
            <View
              key={s.id}
              style={{
                flex: 1,
                height,
                borderRadius: radius.sm / 2,
                backgroundColor: full ? colors.accent : colors.surfaceElevated,
                overflow: 'hidden',
              }}
            >
              {part > 0 ? (
                <View style={{ width: `${part * 100}%`, height: '100%', backgroundColor: colors.accent }} />
              ) : null}
            </View>
          );
        })}
      </View>
      {labels ? (
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {STAGES.map((s, i) => (
            <View key={s.id} style={{ flex: 1 }}>
              <Text
                variant="caption"
                color={i <= reached || i === current ? 'text' : 'textMuted'}
                numberOfLines={1}
                style={{ fontSize: 11, lineHeight: 14 }}
              >
                {s.name}
              </Text>
              {markers && markers[i] ? (
                <Text variant="caption" color="textMuted" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
                  {markers[i]}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
