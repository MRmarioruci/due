import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { C } from './theme';

/**
 * The next 30 days as an open 300° dial: today at the lower left, then clockwise. Bills are small
 * squares on it (bigger for bigger amounts); whatever is in the middle is the screen's headline.
 */
export const DIAL = 300;
const CX = DIAL / 2;
const TICK_R = 140;
const DOT_R = 122;
const SPAN = 300;

export type DialPoint = { key: string; day: number; size: number; color: string; pulse?: boolean };

const angle = (day: number, days: number) => -SPAN / 2 + (day / days) * SPAN;
const at = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CX - r * Math.cos(rad) };
};

const EASE = Easing.out(Easing.cubic);

export function Dial({ days, points, todayColor, label, children }: { days: number; points: DialPoint[]; todayColor: string; label: string; children: ReactNode }) {
  // Settles in: a slight turn and scale up, so the dial feels placed rather than shown.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 900, easing: EASE });
  }, [enter]);
  const ring = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ rotate: `${(1 - enter.value) * -14}deg` }, { scale: 0.94 + 0.06 * enter.value }],
  }));

  const ticks = Array.from({ length: days + 1 }, (_, i) => {
    const week = i % 7 === 0;
    const h = week ? 12 : 6;
    const deg = angle(i, days);
    const a = at(deg, TICK_R - h / 2);
    const b = at(deg, TICK_R + h / 2);
    return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={week ? C.barMuted : C.tick} strokeWidth={1} />;
  });
  const hand = (day: number, length: number, width: number, color: string) => {
    const deg = angle(day, days);
    const a = at(deg, TICK_R - length / 2);
    const b = at(deg, TICK_R + length / 2);
    return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} />;
  };

  return (
    <View style={st.wrap} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        <Svg width={DIAL} height={DIAL}>
          {ticks}
          {hand(0, 22, 2, todayColor)}
        </Svg>
        {points.map((p, i) => (
          <Dot key={p.key} point={p} deg={angle(p.day, days)} delay={350 + i * 70} />
        ))}
      </Animated.View>
      <View style={st.center}>{children}</View>
    </View>
  );
}

function Dot({ point, deg, delay }: { point: DialPoint; deg: number; delay: number }) {
  const { x, y } = at(deg, DOT_R);
  const box = { left: x - point.size / 2, top: y - point.size / 2, width: point.size, height: point.size, transform: [{ rotate: `${deg}deg` }] };
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(420)} style={[st.dot, box]}>
      {point.pulse && <Pulse color={point.color} size={point.size} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: point.color }]} />
    </Animated.View>
  );
}

/** A slow ring breathing out from the bill that needs attention. */
function Pulse({ color, size }: { color: string; size: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 1800, easing: EASE }), withTiming(0, { duration: 0 })), -1));
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - v.value), transform: [{ scale: 1 + v.value * 2.2 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderWidth: 1, borderColor: color }, style]} />;
}

const st = StyleSheet.create({
  wrap: { width: DIAL, height: DIAL, alignSelf: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 38 },
  dot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
