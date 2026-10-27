import { Tabs } from 'expo-router';

import { NavBar } from '@/ui/nav-bar';
import { C } from '@/ui/theme';

/** Home, Bills, Stats and Settings, behind the floating bar with Scan in the middle. */
export default function TabsLayout() {
  return (
    <Tabs backBehavior="firstRoute" tabBar={(props) => <NavBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bills" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
