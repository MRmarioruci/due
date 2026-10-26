import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { locale } from '@/i18n/core';
import { addDaysIso, fromIso } from '@/lib/dates';

import { C, F, themed } from './theme';

/**
 * The next 30 days as an open 300° dial: today at the lower left, then clockwise, with the date at
 * each week mark. Bills are small squares on their day (bigger for bigger amounts); whatever is in
 * the middle is the screen's headline.
 *
 * On load a hand sweeps from today through the month: days light up as it passes and each bill
 * drops onto its day as the hand reaches it, then the hand fades back to today.
 */
export const DIAL = 340;
const CX = DIAL / 2;
const TICK_R = 136;
const DOT_R = 118;
const LABEL_R = 158;
const SPAN = 300;
const SWEEP_DELAY = 250;
const SWEEP_MS = 1500;

export type DialPoint = { key: string; day: number; size: number; color: string; pulse?: boolean };

const AnimatedLine = Animated.createAnimatedComponent(Line);
const EASE = Easing.out(Easing.cubic);

const angle = (day: number, days: number) => -SPAN / 2 + (day / days) * SPAN;
const at = (deg: number, r: number) => {
  'worklet';
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CX - r * Math.cos(rad) };
};
/** When the sweeping hand reaches a day, in ms after mount. */
const reachedAt = (day: number, days: number) => SWEEP_DELAY + SWEEP_EASED(day / days) * SWEEP_MS;
// Inverse of the hand's ease-in-out, so bills land as the hand passes them, not before.
const SWEEP_EASED = (x: number) => (x < 0.5 ? Math.sqrt(x / 2) : 1 - Math.sqrt((1 - x) / 2));

export function Dial({ days, start, points, todayColor, label, children }: { days: number; start: string; points: DialPoint[]; todayColor: string; label: string; children: ReactNode }) {
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withDelay(SWEEP_DELAY, withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }));
  }, [sweep]);

  const weeks = Array.from({ length: Math.floor(days / 7) }, (_, k) => (k + 1) * 7);

  return (
    <View style={st.wrap} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={DIAL} height={DIAL} style={StyleSheet.absoluteFill}>
        {Array.from({ length: days + 1 }, (_, i) => (
          <Tick key={i} i={i} days={days} sweep={sweep} />
        ))}
        <Hand days={days} sweep={sweep} />
        <Today color={todayColor} days={days} />
      </Svg>
      {weeks.map((d) => (
        <WeekLabel key={d} day={d} days={days} start={start} />
      ))}
      {points.map((p) => (
        <Dot key={p.key} point={p} deg={angle(p.day, days)} delay={reachedAt(p.day, days)} />
      ))}
      <View style={st.center}>{children}</View>
    </View>
  );
}

/** A day mark: faint until the hand passes, then lit. Week marks are longer. */
function Tick({ i, days, sweep }: { i: number; days: number; sweep: SharedValue<number> }) {
  const week = i % 7 === 0;
  const h = week ? 12 : 6;
  const deg = angle(i, days);
  const a = at(deg, TICK_R - h / 2);
  const b = at(deg, TICK_R + h / 2);
  const props = useAnimatedProps(() => ({ strokeOpacity: interpolate(sweep.value * days - i, [-1, 0, 0.6], [0.15, 0.15, 1], 'clamp') }));
  return <AnimatedLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={week ? C.barMuted : C.tick} strokeWidth={1} animatedProps={props} />;
}

/** The sweeping hand: from the ring inwards, travelling today → day 30, fading out at the end. */
function Hand({ days, sweep }: { days: number; sweep: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const rad = ((-SPAN / 2 + sweep.value * SPAN) * Math.PI) / 180;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    return {
      x1: CX + (TICK_R + 8) * s,
      y1: CX - (TICK_R + 8) * c,
      x2: CX + (TICK_R - 34) * s,
      y2: CX - (TICK_R - 34) * c,
      strokeOpacity: interpolate(sweep.value, [0, 0.04, 0.85, 1], [0, 0.9, 0.9, 0], 'clamp'),
    };
  });
  return <AnimatedLine stroke={C.fg} strokeWidth={1} animatedProps={props} />;
}

/** Today's mark grows out of the ring first, so the dial starts from "now". */
function Today({ color, days }: { color: string; days: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withSpring(1, { damping: 14, stiffness: 140 });
  }, [grow]);
  const deg = angle(0, days);
  const props = useAnimatedProps(() => {
    const len = 22 * grow.value;
    const a = at(deg, TICK_R - len / 2);
    const b = at(deg, TICK_R + len / 2);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  return <AnimatedLine stroke={color} strokeWidth={2} animatedProps={props} />;
}

/** "3 NOV" outside a week mark, appearing as the hand reaches it. */
function WeekLabel({ day, days, start }: { day: number; days: number; start: string }) {
  const { x, y } = at(angle(day, days), LABEL_R);
  const text = fromIso(addDaysIso(start, day)).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase();
  return (
    <Animated.View entering={FadeIn.delay(reachedAt(day, days)).duration(400)} style={[st.label, { left: x - 30, top: y - 7 }]}>
      <Text style={st.labelText} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

/** A bill, dropping onto its day with a little spring as the hand passes. */
function Dot({ point, deg, delay }: { point: DialPoint; deg: number; delay: number }) {
  const { x, y } = at(deg, DOT_R);
  const land = useSharedValue(0);
  useEffect(() => {
    land.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 180, mass: 0.6 }));
  }, [land, delay]);
  // Falls in from just outside the ring, rotated to sit along it.
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, land.value * 2),
    transform: [{ rotate: `${deg}deg` }, { translateY: (1 - land.value) * -16 }, { scale: 0.4 + 0.6 * land.value }],
  }));
  return (
    <Animated.View style={[st.dot, { left: x - point.size / 2, top: y - point.size / 2, width: point.size, height: point.size }, style]}>
      {point.pulse && <Pulse color={point.color} size={point.size} delay={delay + 500} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: point.color }]} />
    </Animated.View>
  );
}

/** A slow ring breathing out from the bill that needs attention. */
function Pulse({ color, size, delay }: { color: string; size: number; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 1800, easing: EASE }), withTiming(0, { duration: 0 })), -1));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - v.value), transform: [{ scale: 1 + v.value * 2.2 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderWidth: 1, borderColor: color }, style]} />;
}

const st = themed(() => StyleSheet.create({
  wrap: { width: DIAL, height: DIAL, alignSelf: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 58 },
  dot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', width: 60, alignItems: 'center' },
  labelText: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6, color: C.dim },
}));
