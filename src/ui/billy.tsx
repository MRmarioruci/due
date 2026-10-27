import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { t } from '@/i18n/core';
import { REACH, SEAT, standBeside, trackAngle, type BillyMood } from '@/lib/billy';

import { CX, SWEEP_END, TICK_R } from './dial';
import { C, F, themed } from './theme';

/**
 * Billy, a small goat who eats bills. He sits in the gap at the bottom of the home dial and, every
 * so often, wanders along the inside of the ring: up to the next bill to sniff it, off for a
 * stroll, or (with nothing due) back to sleep. A bill saved a moment ago gets eaten first. Tap him
 * and he hops. He holds still while the screen is out of view, being scrolled, or when the phone
 * asks for reduced motion.
 */
const R = TICK_R - 10;
const DIAL_W = CX * 2;
const W = 58;
const H = 52;
const FUR = '#F3F1EC';
const HORN = '#c9c6be';
const INK = '#0a0a0a';
// Draws his edge on the light theme, where white fur would vanish.
const EDGE = '#2b2b2b';

type Face = 'idle' | 'chew' | 'happy' | 'sleep' | 'worried' | 'yawn';
export type BillyTarget = { dialDeg: number; payee: string; daysLeft: number };

let lastTouch = 0;
/** Call while the user is scrolling or touching the screen: Billy waits for them. */
export const billyHold = () => {
  lastTouch = Date.now();
};
/** Bills Billy has eaten, so each one is a meal once. */
const eaten = new Set<string>();

const baseFace = (mood: BillyMood): Face => (mood === 'calm' ? 'sleep' : mood === 'late' ? 'worried' : 'idle');
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const between = (a: number, b: number) => a + Math.random() * (b - a);

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

export function Billy({ mood, target, fed, active }: { mood: BillyMood; target: BillyTarget | null; fed: { id: string; payee: string } | null; active: boolean }) {
  const reduced = useReducedMotion();
  const [face, setFace] = useState<Face>(baseFace(mood));
  const [line, setLine] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const theta = useSharedValue(SEAT);
  const hop = useSharedValue(0);
  const step = useSharedValue(0);
  const lean = useSharedValue(0);
  const look = useSharedValue(0);
  const lookUp = useSharedValue(0);
  const lid = useSharedValue(0);
  const chew = useSharedValue(0);
  const zz = useSharedValue(0);
  const pop = useSharedValue(reduced ? 1 : 0);

  const popped = useRef(false);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const moving = active && appActive && !reduced;

  // The behaviour script: pop up after the dial's entrance, eat a fresh bill or greet, then an
  // outing every 20–40 s. Any change (mood, the next bill, leaving the screen) restarts it.
  useEffect(() => {
    let cancelled = false;
    const alive = () => !cancelled;
    const wait = (ms: number) => new Promise<boolean>((done) => setTimeout(() => done(alive()), ms));
    const rest = baseFace(mood);

    if (!moving) {
      theta.set(SEAT);
      step.set(0);
      lean.set(0);
      look.set(0);
      lookUp.set(0);
      chew.set(0);
      return;
    }

    const say = async (text: string, ms = 2600) => {
      setLine(text);
      const ok = await wait(ms);
      setLine((l) => (l === text ? null : l));
      return ok;
    };
    const walkTo = async (to: number, speed = 1) => {
      const from = theta.get();
      if (Math.abs(to - from) < 0.5) return alive();
      const ms = (Math.abs(to - from) * 42) / speed;
      // Higher angles are towards today, on the left.
      const dir = to > from ? -1 : 1;
      look.set(withTiming(dir, { duration: 200 }));
      lean.set(withTiming(dir * 6, { duration: 200 }));
      step.set(withRepeat(withTiming(1, { duration: 130 / speed }), -1, true));
      theta.set(withTiming(to, { duration: ms, easing: Easing.inOut(Easing.quad) }));
      const ok = await wait(ms);
      step.set(withTiming(0, { duration: 120 }));
      lean.set(withTiming(0, { duration: 200 }));
      return ok;
    };
    const jump = async () => {
      hop.set(withSequence(withTiming(12, { duration: 150, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })));
      return wait(400);
    };
    const lookAround = async () => {
      look.set(withTiming(-1, { duration: 250 }));
      if (!(await wait(800))) return false;
      look.set(withTiming(1, { duration: 300 }));
      if (!(await wait(900))) return false;
      look.set(withTiming(0, { duration: 250 }));
      return wait(300);
    };
    const stroll = async () => {
      const side = Math.random() < 0.5 ? 1 : -1;
      if (!(await walkTo(SEAT + side * between(18, REACH - 10)))) return false;
      if (!(await lookAround())) return false;
      if (mood === 'empty' && Math.random() < 0.5 && !(await say(t('billy.hungry')))) return false;
      if (!(await walkTo(SEAT))) return false;
      look.set(withTiming(0, { duration: 250 }));
      return true;
    };
    const visit = async () => {
      if (!target) return stroll();
      const dot = trackAngle(target.dialDeg);
      const late = target.daysLeft < 0;
      if (!(await walkTo(standBeside(dot), late ? 1.6 : 1))) return false;
      look.set(withTiming(dot > SEAT ? -1 : 1, { duration: 200 }));
      lookUp.set(withTiming(1, { duration: 300 }));
      setFace('chew');
      chew.set(withRepeat(withTiming(1, { duration: 160 }), 8, true));
      if (!(await wait(1300))) return false;
      chew.set(withTiming(0, { duration: 100 }));
      setFace(late ? 'worried' : 'idle');
      const text = late ? t('billy.late') : target.daysLeft === 0 ? t('billy.today', { payee: target.payee }) : pick([t('billy.fresh', { payee: target.payee }), t('billy.never')]);
      if (!(await say(text))) return false;
      lookUp.set(withTiming(0, { duration: 300 }));
      if (!(await walkTo(SEAT, late ? 1.6 : 1))) return false;
      look.set(withTiming(0, { duration: 250 }));
      setFace(rest);
      return true;
    };
    const wake = async () => {
      setFace('idle');
      if (!(await jump())) return false;
      if (!(await say(t('billy.up'), 1600))) return false;
      if (!(await stroll())) return false;
      setFace('yawn');
      if (!(await wait(900))) return false;
      setFace('sleep');
      return true;
    };
    const eat = async (payee: string) => {
      setFace('chew');
      chew.set(withRepeat(withTiming(1, { duration: 150 }), 14, true));
      if (!(await say(t('billy.nom', { payee }), 2200))) return false;
      chew.set(withTiming(0, { duration: 100 }));
      setFace('happy');
      if (!(await jump())) return false;
      if (!(await wait(1400))) return false;
      setFace(rest);
      return true;
    };
    const greet = async () => {
      if (mood === 'empty') return say(t('billy.hungry'));
      if (mood === 'calm') {
        setFace('idle');
        if (!(await say(t('billy.nap'), 2200))) return false;
        setFace('yawn');
        if (!(await wait(900))) return false;
        setFace('sleep');
        return true;
      }
      return visit();
    };
    const outing = async () => {
      const r = Math.random();
      if (mood === 'calm') return r < 0.6 ? wake() : true;
      if (mood === 'empty') return r < 0.5 ? lookAround().then((ok) => ok && say(t('billy.hungry'))) : stroll();
      if (mood === 'late') return r < 0.7 ? visit() : stroll();
      return r < 0.55 ? visit() : r < 0.8 ? stroll() : lookAround();
    };

    (async () => {
      if (!popped.current) {
        if (!(await wait(SWEEP_END + 300))) return;
        popped.current = true;
        pop.set(withSpring(1, { damping: 11, stiffness: 160 }));
        if (!(await wait(500))) return;
      }
      if (fed && !eaten.has(fed.id)) {
        eaten.add(fed.id);
        if (!(await eat(fed.payee))) return;
      } else if (!(await greet())) return;
      while (alive()) {
        if (!(await wait(between(20_000, 40_000)))) return;
        if (Date.now() - lastTouch < 4000) continue;
        if (!(await outing())) return;
      }
    })();

    return () => {
      cancelled = true;
      // Back to his seat if he was out when things changed.
      theta.set(withTiming(SEAT, { duration: 500 }));
      step.set(0);
      lean.set(withTiming(0));
      chew.set(0);
      setLine(null);
    };
    // Shared values are stable; the target matters only by where it is and what it's called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, mood, target?.dialDeg, target?.payee, target?.daysLeft, fed?.id]);

  // A resting face follows the mood when nothing else is going on.
  const [shownMood, setShownMood] = useState(mood);
  if (shownMood !== mood) {
    setShownMood(mood);
    setFace(baseFace(mood));
  }

  // Blinks on his own clock, so he never quite repeats.
  useEffect(() => {
    if (!moving) return;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        lid.set(withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 })));
        next();
      }, between(2500, 6000));
    };
    next();
    return () => clearTimeout(timer);
  }, [moving, lid]);

  const asleep = face === 'sleep';
  useEffect(() => {
    zz.set(asleep && moving ? withRepeat(withTiming(1, { duration: 2400 }), -1, false) : 0);
  }, [asleep, moving, zz]);

  useEffect(() => () => {
    if (lineTimer.current) clearTimeout(lineTimer.current);
  }, []);

  const onTap = () => {
    Haptics.selectionAsync();
    hop.set(withSequence(withTiming(14, { duration: 140, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })));
    const text = asleep ? t('billy.up') : mood === 'empty' ? t('billy.both') : pick([t('billy.tickle'), t('billy.both'), t('billy.never')]);
    if (asleep) setFace('idle');
    setLine(text);
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => {
      setLine((l) => (l === text ? null : l));
      if (asleep) setFace('sleep');
    }, 2400);
  };

  // Feet on the ring, standing up from it; hops and steps push him along his own "up".
  const body = useAnimatedStyle(() => {
    const th = theta.get();
    const rad = (th * Math.PI) / 180;
    const x = CX + R * Math.sin(rad);
    const y = CX - R * Math.cos(rad);
    return {
      opacity: Math.min(1, pop.get() * 1.5),
      transform: [
        { translateX: x - W / 2 },
        { translateY: y - H / 2 },
        // Half-upright to the ring: a full tilt reads as falling over.
        { rotate: `${(th - 180) * 0.5 + lean.get()}deg` },
        { translateY: -H / 2 - hop.get() - step.get() * 2.5 + (1 - pop.get()) * 26 },
      ],
    };
  });
  // Speech goes under his feet, outside the ring, so it never covers the headline in the middle.
  const bubble = useAnimatedStyle(() => {
    const rad = (theta.get() * Math.PI) / 180;
    const r = R + 6;
    const x = Math.min(DIAL_W - 110, Math.max(110, CX + r * Math.sin(rad)));
    return { transform: [{ translateX: x - 110 }, { translateY: CX - r * Math.cos(rad) }] };
  });

  const worried = face === 'worried';
  const pupilL = useAnimatedProps(() => ({ x: 41.5 + look.get() * 3.5, y: 53 - lookUp.get() * 2.5 + (worried ? 1.5 : 0) }));
  const pupilR = useAnimatedProps(() => ({ x: 67.5 + look.get() * 3.5, y: 53 - lookUp.get() * 2.5 + (worried ? 1.5 : 0) }));
  const lidL = useAnimatedProps(() => ({ height: lid.get() * 20 }));
  const lidR = useAnimatedProps(() => ({ height: lid.get() * 20 }));
  const mouth = useAnimatedProps(() => {
    const c = chew.get() * 3;
    return { d: face === 'chew' ? `M52 ${83 + c} L68 ${83 + c}` : `M51 ${83 + c} Q60 89 69 ${83 + c}` };
  });
  const zzProps = useAnimatedProps(() => ({ opacity: Math.sin(zz.get() * Math.PI) }));

  const open = face !== 'sleep' && face !== 'happy';
  const brow = worried ? 'M40 41 L54 45 M66 45 L80 41' : face === 'sleep' ? 'M40 46 L54 46 M66 46 L80 46' : 'M39 42 L54 43 M66 43 L81 42';

  return (
    <>
      <Animated.View pointerEvents="box-none" style={[st.body, body]}>
        <Pressable onPress={onTap} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('billy.a11y')} style={StyleSheet.absoluteFill}>
          <Svg width={W} height={H} viewBox="0 8 120 108" style={{ overflow: 'visible' }}>
            <G stroke={EDGE} strokeWidth={2.5}>
              <Rect x={40} y={96} width={9} height={17} rx={2} fill={FUR} />
              <Rect x={71} y={96} width={9} height={17} rx={2} fill={FUR} />
            </G>
            <Rect x={40} y={108} width={9} height={5} fill="#5f5f5f" />
            <Rect x={71} y={108} width={9} height={5} fill="#5f5f5f" />
            <Path d="M44 30 C38 13 25 11 20 20" fill="none" stroke={HORN} strokeWidth={6} strokeLinecap="round" />
            <Path d="M76 30 C82 13 95 11 100 20" fill="none" stroke={HORN} strokeWidth={6} strokeLinecap="round" />
            <G stroke={EDGE} strokeWidth={2.5} fill={FUR}>
              <Ellipse cx={26} cy={50} rx={11} ry={5} rotation={worried ? 20 : -18} origin="32, 50" />
              <Ellipse cx={94} cy={50} rx={11} ry={5} rotation={worried ? -20 : 18} origin="88, 50" />
              <Rect x={30} y={27} width={60} height={75} rx={16} />
            </G>
            <Path d="M55 101 L60 112 L65 101 Z" fill={HORN} />

            {open && (
              <G>
                <Circle cx={47} cy={55} r={9.5} fill="#fff" stroke={INK} strokeWidth={2} />
                <Circle cx={73} cy={55} r={9.5} fill="#fff" stroke={INK} strokeWidth={2} />
                <AnimatedRect width={11} height={4.2} rx={1} fill={INK} animatedProps={pupilL} />
                <AnimatedRect width={11} height={4.2} rx={1} fill={INK} animatedProps={pupilR} />
                <AnimatedRect x={36.5} y={44.5} width={21} fill={FUR} animatedProps={lidL} />
                <AnimatedRect x={62.5} y={44.5} width={21} fill={FUR} animatedProps={lidR} />
              </G>
            )}
            {face === 'happy' && <Path d="M39 57 Q47 48 55 57 M65 57 Q73 48 81 57" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />}
            {face === 'sleep' && <Path d="M39 56 H55 M65 56 H81" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />}
            <Path d={brow} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />

            <Rect x={55} y={68} width={10} height={8} fill={C.accent} />
            {face === 'yawn' ? (
              <Ellipse cx={60} cy={86} rx={6} ry={6.5} fill={INK} />
            ) : face === 'happy' ? (
              <Path d="M50 82 Q60 92 70 82 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            ) : worried ? (
              <Path d="M51 86 Q55 82 60 86 Q65 90 69 86" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
            ) : (
              <AnimatedPath fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" animatedProps={mouth} />
            )}
            {face === 'chew' && <Rect x={64} y={80} width={14} height={9} fill="#fff" stroke={HORN} strokeWidth={1} rotation={-12} origin="64, 80" />}
            {worried && <Path d="M93 34 C97 40 99 44 96 47 C93 49 89 46 91 41 Z" fill="#3FD4F0" />}
            {asleep && (
              <AnimatedG animatedProps={zzProps}>
                <SvgText x={90} y={30} fontSize={14} fill={C.dim} fontFamily={F.mono}>
                  z
                </SvgText>
                <SvgText x={100} y={16} fontSize={18} fill={C.dim} fontFamily={F.mono}>
                  Z
                </SvgText>
              </AnimatedG>
            )}
          </Svg>
        </Pressable>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[st.bubbleSlot, bubble]}>
        {line && (
          <Animated.View key={line} entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={st.bubble}>
            <Text style={st.bubbleText} numberOfLines={2} accessibilityLiveRegion="polite">
              {line}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </>
  );
}

const st = themed(() => StyleSheet.create({
  body: { position: 'absolute', left: 0, top: 0, width: W, height: H },
  bubbleSlot: { position: 'absolute', left: 0, top: 0, width: 220, height: 60, alignItems: 'center', justifyContent: 'flex-start' },
  bubble: { maxWidth: 220, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 16, color: C.fg, textAlign: 'center' },
}));
