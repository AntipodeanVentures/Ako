import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';

import { Text } from '@/src/components/ui';
import { palettes, useTheme } from '@/src/theme';

// The three tabs. On a phone they fill the width as usual. On a laptop
// browser the bar keeps its full-width top rule, but the tabs sit in a
// column no wider than the content above them, so Map, Session and Record
// are not flung to the corners of a wide window.
const MAX_WIDTH = 560;

type IconName = ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, [IconName, IconName]> = {
  map: ['git-network-outline', 'git-network'],
  session: ['play-circle-outline', 'play-circle'],
  record: ['document-text-outline', 'document-text'],
};

export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors: themed, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width > MAX_WIDTH + spacing.xl * 2;
  // The map is a dark canvas whatever the app's mode, and the bar under it matches.
  const colors = state.routes[state.index]?.name === 'map' ? palettes.dark : themed;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 0 : 4),
      }}
    >
      <View style={{ flexDirection: 'row', width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const focused = state.index === index;
          const [outline, filled] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole={Platform.OS === 'web' ? 'link' : 'button'}
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                paddingTop: wide ? spacing.md : spacing.sm,
                paddingBottom: wide ? spacing.md : spacing.sm,
                minHeight: 52,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name={focused ? filled : outline} size={22} color={focused ? colors.text : colors.textMuted} />
              <Text variant="caption" style={{ fontSize: 11, lineHeight: 14, color: focused ? colors.text : colors.textMuted }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
