import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n/core';
import { openScan } from '@/lib/nav';

import { Icon, T } from './kit';
import { C, F, themed } from './theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const BAR_H = 64;
const LIFT = 14;
/** Space a tab screen leaves at the bottom so its last row clears the floating bar. */
export const NAV_SPACE = BAR_H + LIFT + 28;

/** The four tabs around the scan button, in order; scan sits between the second and third. */
const TABS = [
  { name: 'index', icon: 'home', label: 'nav.home' },
  { name: 'bills', icon: 'list', label: 'nav.bills' },
  { name: 'stats', icon: 'stats', label: 'common.stats' },
  { name: 'settings', icon: 'settings', label: 'common.settings' },
] as const;
/** Slot of each tab in the five-wide bar (slot 2 is scan). */
const SLOT = [0, 1, 3, 4];

/**
 * The floating bottom bar: Home, Bills, Scan, Stats, Settings. Scan is a white square raised out of
 * the bar (the main action); the current tab is lit, with an accent line that slides between tabs.
 * The bar steps aside while the keyboard is up.
 */
export function NavBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const current = state.routes[state.index]?.name;
  const slot = SLOT[Math.max(0, TABS.findIndex((tab) => tab.name === current))];

  const x = useSharedValue(0);
  useEffect(() => {
    if (width) x.value = withSpring(((slot + 0.5) * width) / 5 - 9, { damping: 18, stiffness: 220 });
  }, [slot, width, x]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;

  const bottom = insets.bottom + LIFT;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (name !== current && !event.defaultPrevented) {
      Haptics.selectionAsync();
      navigation.navigate(name);
    }
  };

  const cells = TABS.map((tab) => {
    const on = tab.name === current;
    return (
      <Pressable key={tab.name} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t(tab.label)} onPress={() => go(tab.name)} style={st.cell}>
        <Icon name={tab.icon} size={20} color={on ? C.fg : C.dim} />
        <T style={[st.label, on && { color: C.fg, fontFamily: F.medium }]}>{t(tab.label)}</T>
      </Pressable>
    );
  });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Content fades out under the bar instead of being cut off by it. */}
      <Svg pointerEvents="none" width="100%" height={bottom + BAR_H + 40} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.bg} stopOpacity={0} />
            <Stop offset="0.55" stopColor={C.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
      <View accessibilityRole="tablist" onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={[st.bar, { bottom }]}>
        {cells.slice(0, 2)}
        <View style={st.cell}>
          <ScanButton />
        </View>
        {cells.slice(2)}
        <Animated.View pointerEvents="none" style={[st.line, line]} />
      </View>
    </View>
  );
}

/** The raised scan square: a press squeezes it a little before the camera opens. */
function ScanButton() {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[st.scanWrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan')}
        onPressIn={() => s.set(withTiming(0.92, { duration: 90, easing: Easing.out(Easing.quad) }))}
        onPressOut={() => s.set(withSpring(1, { damping: 12, stiffness: 260 }))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          openScan();
        }}
        style={st.scan}>
        <Icon name="scan" size={24} color={C.bg} />
        <View style={st.scanDot} />
      </Pressable>
    </Animated.View>
  );
}

const st = themed(() => StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, height: BAR_H, flexDirection: 'row', backgroundColor: C.sheet, borderWidth: 1, borderColor: C.border },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontSize: 10.5, color: C.dim },
  line: { position: 'absolute', top: -1, left: 0, width: 18, height: 2, backgroundColor: C.accent },
  // The ring in the background colour makes the square look cut out of the bar.
  scanWrap: { marginTop: -34, borderWidth: 6, borderColor: C.bg },
  scan: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fg },
  scanDot: { position: 'absolute', right: 6, top: 6, width: 5, height: 5, backgroundColor: C.accent },
}));
