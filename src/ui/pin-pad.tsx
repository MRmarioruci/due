import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { PIN_LENGTH } from '@/lib/pin';

import { Icon, T } from './kit';
import { C, F } from './theme';

/**
 * Dots plus a 3×4 keypad. Calls `onComplete` when all digits are in; resolve it to false to shake
 * and clear (wrong PIN). `extraKey` fills the bottom-left slot, e.g. a fingerprint button.
 */
export function PinPad({ title, hint, onComplete, extraKey }: { title: string; hint?: string | null; onComplete: (pin: string) => Promise<boolean> | boolean; extraKey?: { label: string; onPress: () => void } }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  async function submit(full: string) {
    setBusy(true);
    const ok = await onComplete(full);
    if (!ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake.set(withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })));
    }
    setPin('');
    setBusy(false);
  }

  const press = (d: string) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    Haptics.selectionAsync();
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
      <T style={st.title}>{title}</T>
      <T style={[st.hint, !hint && { opacity: 0 }]}>{hint ?? ' '}</T>
      <Animated.View style={[st.dots, shakeStyle]} accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[st.dot, i < pin.length && st.dotOn]} />
        ))}
      </Animated.View>
      <View style={st.grid}>
        {keys.map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} />
        ))}
        {extraKey ? (
          <Pressable accessibilityRole="button" accessibilityLabel={extraKey.label} onPress={extraKey.onPress} style={({ pressed }) => [st.key, pressed && st.keyPressed]}>
            <T style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: 0.6, color: C.muted, textAlign: 'center' }}>{extraKey.label.toUpperCase()}</T>
          </Pressable>
        ) : (
          <View style={st.key} />
        )}
        <Key label="0" onPress={() => press('0')} />
        <Pressable accessibilityRole="button" accessibilityLabel="Delete digit" onPress={() => setPin((p) => p.slice(0, -1))} style={({ pressed }) => [st.key, pressed && st.keyPressed]}>
          <Icon name="back" color={C.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function Key({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [st.key, pressed && st.keyPressed]}>
      <T style={{ fontFamily: F.medium, fontSize: 26, fontVariant: ['tabular-nums'] }}>{label}</T>
    </Pressable>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: F.semibold, fontSize: 19, letterSpacing: -0.4 },
  hint: { marginTop: 6, fontSize: 13.5, color: C.accent, minHeight: 20 },
  dots: { flexDirection: 'row', gap: 18, marginTop: 18, marginBottom: 26 },
  dot: { width: 12, height: 12, borderWidth: 1.5, borderColor: C.barMuted },
  dotOn: { backgroundColor: C.fg, borderColor: C.fg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 276, gap: 12 },
  key: { width: 84, height: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  keyPressed: { backgroundColor: C.surface },
});
