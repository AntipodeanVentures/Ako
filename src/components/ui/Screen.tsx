import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme';

// How wide the content column may grow. On a phone every width fills the
// screen; on a laptop browser the column sits centred with the page's
// white around it, so the empty space reads as margin rather than as
// something missing.
export type ScreenWidth = 'narrow' | 'reading' | 'wide';
const MAX_WIDTH: Record<ScreenWidth, number> = { narrow: 440, reading: 560, wide: 720 };

type Props = {
  children: ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  width?: ScreenWidth;
  // Lets an ambient backdrop (a full-bleed level card, say) behind the screen show
  // through, instead of painting the solid background colour.
  transparent?: boolean;
};

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  contentStyle,
  refreshing,
  onRefresh,
  width = 'reading',
  transparent = false,
}: Props) {
  const { colors, spacing } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const maxWidth = MAX_WIDTH[width];
  const wide = windowWidth > maxWidth + spacing.xl * 2;

  const column: ViewStyle = {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    // More air top and bottom once there is room for it.
    paddingVertical: wide ? spacing.xxl * 1.5 : spacing.xl,
  };

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.fill,
        { backgroundColor: transparent ? 'transparent' : colors.background },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[styles.grow, column, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={Boolean(refreshing)}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, column, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
});
