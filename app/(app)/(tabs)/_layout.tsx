import { Tabs } from 'expo-router';

import { TabBar } from '@/src/components/TabBar';

// Three places: the map of what you know (the home), the session (what is next and every
// subject), and the record (what you can stand behind, shareable).
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="session" options={{ title: 'Session' }} />
      <Tabs.Screen name="record" options={{ title: 'Record' }} />
    </Tabs>
  );
}
