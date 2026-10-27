import { Tabs } from 'expo-router';

import { NavBar } from '@/ui/nav-bar';
import { C } from '@/ui/theme';

/**
 * Home, Bills, Stats and Settings, behind the floating bar with Scan in the middle. Tabs switch
 * instantly and stay mounted: with a fade, a tab opened mid-transition could stay invisible.
 */
export default function TabsLayout() {
  return (
    <Tabs backBehavior="firstRoute" tabBar={(props) => <NavBar {...props} />} screenOptions={{ headerShown: false, animation: 'none', lazy: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bills" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
