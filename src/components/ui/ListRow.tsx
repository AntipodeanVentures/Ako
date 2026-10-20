import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/src/theme';
import { Text } from './Text';

type IconName = keyof typeof Ionicons.glyphMap;

type ListRowProps = {
  label: string;
  description?: string;
  // A short trailing value ("7:10am", "On"), shown before the chevron.
  value?: string;
  icon?: IconName;
  onPress?: () => void;
};

// A single tappable navigation row: an optional tinted leading icon, a
// label with optional sub-label, and a trailing chevron. Designed to sit
// inside a ListGroup.
export function ListRow({ label, description, value, icon, onPress }: ListRowProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.primaryMuted : 'transparent',
      })}
    >
      {icon ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.md,
            backgroundColor: colors.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" color="textMuted">
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

// A grouped surface for ListRows, with hairline dividers between them.
// The shadow sits on an outer view so it is not clipped by the rounded
// corners of the clipping inner view.
export function ListGroup({ children }: { children: ReactNode }) {
  const { colors, radius, elevation, spacing } = useTheme();
  const rows = Children.toArray(children);

  return (
    <View style={[{ borderRadius: radius.lg }, elevation.card]}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: colors.border,
                  marginHorizontal: spacing.lg,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}
