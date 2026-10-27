import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { t, type Key } from '@/i18n/core';
import { HOME_X, ROAM, underBill, type BillyMood } from '@/lib/billy';

import { SWEEP_END } from './dial';
import { C, F, themed } from './theme';

/**
 * Billy, a small goat who eats bills. He lives on a strip under the home dial, fidgets every few
 * seconds and, every so often, walks off along it: under the next bill to sniff it, for a dance, a
 * spin or zoomies, or (with nothing due) back to sleep, talking in his sleep. A bill saved a moment
 * ago gets eaten first. He looks up when you drag the dial onto a bill. Tap him and he hops. He holds
 * still while the screen is out of view, being scrolled, or when the phone asks for reduced motion.
 */
const W = 64;
const H = Math.round(W * 0.9);
const FUR = '#F3F1EC';
const HORN = '#c9c6be';
const INK = '#0a0a0a';
const BLUSH = '#FF8C78';
// Draws his edge on the light theme, where white fur would vanish.
const EDGE = '#2b2b2b';

type Face = 'idle' | 'chew' | 'happy' | 'sleep' | 'worried' | 'sad' | 'yawn';
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
const chance = (p: number) => Math.random() < p;

const QUIPS = ['meh', 'crunchy', 'parking', 'fibre', 'notCalendar', 'guard', 'payday', 'lateFees'] as const;
/** Something to say, with lines that fit the mood mixed in. */
function quip(mood: BillyMood): string {
  const own: Key[] = mood === 'calm' ? ['billy.calm1', 'billy.calm2'] : mood === 'late' ? ['billy.late', 'billy.late2'] : mood === 'empty' ? ['billy.hungry', 'billy.both'] : ['billy.never'];
  return t(pick([...own, ...own, ...QUIPS.map((q) => `billy.q.${q}` as const)]));
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);

type Parts = { look: SharedValue<number>; lookUp: SharedValue<number>; lid: SharedValue<number>; chew: SharedValue<number>; zz: SharedValue<number>; ear: SharedValue<number> };

function useParts(): Parts {
  const look = useSharedValue(0);
  const lookUp = useSharedValue(0);
  const lid = useSharedValue(0);
  const chew = useSharedValue(0);
  const zz = useSharedValue(0);
  const ear = useSharedValue(0);
  return { look, lookUp, lid, chew, zz, ear };
}

/** Blinks on his own clock, sometimes twice, so he never quite repeats. */
function useBlink(lid: SharedValue<number>, on: boolean) {
  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout>;
    const once = () => [withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 })];
    const next = () => {
      timer = setTimeout(() => {
        lid.set(chance(0.2) ? withSequence(...once(), ...once()) : withSequence(...once()));
        next();
      }, between(2200, 5500));
    };
    next();
    return () => clearTimeout(timer);
  }, [on, lid]);
}

const flickEar = (ear: SharedValue<number>) => ear.set(withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 140 }), withTiming(1, { duration: 90 }), withTiming(0, { duration: 160 })));

/** The goat himself, facing you. Everything that moves comes in through `parts`. */
function BillyArt({ face, parts, width }: { face: Face; parts: Parts; width: number }) {
  const { look, lookUp, lid, chew, zz, ear } = parts;
  const down = face === 'worried' || face === 'sad' ? 1.5 : 0;
  const pupilL = useAnimatedProps(() => ({ x: 41 + look.get() * 3.5, y: 51.8 - lookUp.get() * 2.5 + down }));
  const pupilR = useAnimatedProps(() => ({ x: 67 + look.get() * 3.5, y: 51.8 - lookUp.get() * 2.5 + down }));
  const shineL = useAnimatedProps(() => ({ x: 47.5 + look.get() * 3.5, y: 52.6 - lookUp.get() * 2.5 + down }));
  const shineR = useAnimatedProps(() => ({ x: 73.5 + look.get() * 3.5, y: 52.6 - lookUp.get() * 2.5 + down }));
  const lidL = useAnimatedProps(() => ({ height: lid.get() * 23 }));
  const lidR = useAnimatedProps(() => ({ height: lid.get() * 23 }));
  const earL = useAnimatedProps(() => ({ cy: 50 - ear.get() * 6 }));
  const earR = useAnimatedProps(() => ({ cy: 50 - ear.get() * 6 }));
  const mouth = useAnimatedProps(() => {
    const c = chew.get() * 3;
    return { d: face === 'chew' ? `M52 ${84 + c} L68 ${84 + c}` : `M52 ${84 + c} Q56 ${88 + c} 60 ${85 + c} Q64 ${88 + c} 68 ${84 + c}` };
  });
  const zzProps = useAnimatedProps(() => ({ opacity: Math.sin(zz.get() * Math.PI) }));

  const sad = face === 'worried' || face === 'sad';
  const open = face !== 'sleep' && face !== 'happy';
  const brow = sad ? 'M40 44 L54 39 M66 39 L80 44' : face === 'sleep' ? 'M40 45 L54 45 M66 45 L80 45' : 'M40 41 Q47 37 54 41 M66 41 Q73 37 80 41';
  const ears = sad ? [24, -24] : [-18, 18];
  const blush = face === 'sleep' ? 0.3 : 0.5;

  return (
    <Svg width={width} height={width * 0.9} viewBox="0 8 120 108" style={{ overflow: 'visible' }}>
      <G stroke={EDGE} strokeWidth={2.5}>
        <Rect x={40} y={96} width={9} height={17} rx={2} fill={FUR} />
        <Rect x={71} y={96} width={9} height={17} rx={2} fill={FUR} />
      </G>
      <Rect x={40} y={108} width={9} height={5} fill="#5f5f5f" />
      <Rect x={71} y={108} width={9} height={5} fill="#5f5f5f" />
      <Path d="M44 30 C38 13 25 11 20 20" fill="none" stroke={HORN} strokeWidth={6} strokeLinecap="round" />
      <Path d="M76 30 C82 13 95 11 100 20" fill="none" stroke={HORN} strokeWidth={6} strokeLinecap="round" />
      <G stroke={EDGE} strokeWidth={2.5} fill={FUR}>
        <AnimatedEllipse cx={26} rx={11} ry={5.5} transform={`rotate(${ears[0]} 32 50)`} animatedProps={earL} />
        <AnimatedEllipse cx={94} rx={11} ry={5.5} transform={`rotate(${ears[1]} 88 50)`} animatedProps={earR} />
        <Rect x={30} y={27} width={60} height={75} rx={18} />
        {/* A tuft between the horns. */}
        <Path d="M51 29 Q55 19 60 27 Q65 19 69 29" />
      </G>
      <Path d="M55 101 L60 112 L65 101 Z" fill={HORN} />

      <Ellipse cx={39} cy={73} rx={6} ry={3.5} fill={BLUSH} opacity={blush} />
      <Ellipse cx={81} cy={73} rx={6} ry={3.5} fill={BLUSH} opacity={blush} />

      {open && (
        <G>
          <Circle cx={47} cy={55} r={10.5} fill="#fff" stroke={INK} strokeWidth={2} />
          <Circle cx={73} cy={55} r={10.5} fill="#fff" stroke={INK} strokeWidth={2} />
          <AnimatedRect width={12} height={7} rx={3.5} fill={INK} animatedProps={pupilL} />
          <AnimatedRect width={12} height={7} rx={3.5} fill={INK} animatedProps={pupilR} />
          <AnimatedRect width={2.6} height={2.6} rx={1.3} fill="#fff" animatedProps={shineL} />
          <AnimatedRect width={2.6} height={2.6} rx={1.3} fill="#fff" animatedProps={shineR} />
          <AnimatedRect x={35.5} y={43.5} width={23} fill={FUR} animatedProps={lidL} />
          <AnimatedRect x={61.5} y={43.5} width={23} fill={FUR} animatedProps={lidR} />
        </G>
      )}
      {face === 'happy' && <Path d="M38 57 Q47 47 56 57 M64 57 Q73 47 82 57" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />}
      {face === 'sleep' && <Path d="M39 57 Q47 61 55 57 M65 57 Q73 61 81 57" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />}
      <Path d={brow} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />

      <Rect x={55} y={68} width={10} height={8} rx={1.5} fill={C.accent} />
      {face === 'yawn' ? (
        <Ellipse cx={60} cy={87} rx={6} ry={6.5} fill={INK} />
      ) : face === 'happy' ? (
        <Path d="M50 82 Q60 93 70 82 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      ) : face === 'worried' ? (
        <Path d="M51 87 Q55 83 60 87 Q65 91 69 87" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      ) : face === 'sad' ? (
        <Path d="M52 89 Q60 83 68 89" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      ) : (
        <AnimatedPath fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" animatedProps={mouth} />
      )}
      {face === 'chew' && <Rect x={64} y={81} width={14} height={9} fill="#fff" stroke={HORN} strokeWidth={1} transform="rotate(-12 64 81)" />}
      {face === 'worried' && <Path d="M93 34 C97 40 99 44 96 47 C93 49 89 46 91 41 Z" fill="#3FD4F0" />}
      {face === 'sleep' && (
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
  );
}

function Bubble({ line }: { line: string | null }) {
  if (!line) return null;
  return (
    <Animated.View key={line} entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={st.bubble}>
      <Text style={st.bubbleText} numberOfLines={3} accessibilityLiveRegion="polite">
        {line}
      </Text>
    </Animated.View>
  );
}

/** Height of Billy's strip under the dial. */
export const BILLY_STRIP = H + 14;

type Side = 'left' | 'right';

export function Billy({ mood, target, fed, peek, hint = false, active }: { mood: BillyMood; target: BillyTarget | null; fed: { id: string; payee: string } | null; peek: string | null; hint?: boolean; active: boolean }) {
  const reduced = useReducedMotion();
  const [face, setFace] = useState<Face>(baseFace(mood));
  const [line, setLine] = useState<string | null>(null);
  const [side, setSide] = useState<Side>('right');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [rowW, setRowW] = useState(340);

  const parts = useParts();
  const { look, lookUp, chew, zz, ear } = parts;
  const x = useSharedValue(HOME_X);
  const hop = useSharedValue(0);
  const step = useSharedValue(0);
  const lean = useSharedValue(0);
  const pop = useSharedValue(reduced ? 1 : 0);

  const popped = useRef(false);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const moving = active && appActive && !reduced;

  // Speech goes on whichever side of him has more room.
  const sideFor = (at: number): Side => (at <= 0 ? 'right' : 'left');

  // The behaviour script: pop up after the dial's entrance, eat a fresh bill or greet, then a
  // fidget every few seconds and an outing every 10–20 s. Any change (mood, the next bill, leaving
  // the screen) restarts it.
  useEffect(() => {
    let cancelled = false;
    const alive = () => !cancelled;
    const wait = (ms: number) => new Promise<boolean>((done) => setTimeout(() => done(alive()), ms));
    const rest = baseFace(mood);

    if (!moving) {
      x.set(HOME_X);
      step.set(0);
      lean.set(0);
      look.set(0);
      lookUp.set(0);
      chew.set(0);
      return;
    }

    const say = async (text: string, ms = 2600) => {
      setSide(sideFor(x.get()));
      setLine(text);
      const ok = await wait(ms);
      setLine((l) => (l === text ? null : l));
      return ok;
    };
    const walkTo = async (to: number, speed = 1) => {
      const from = x.get();
      if (Math.abs(to - from) < 1) return alive();
      const ms = (Math.abs(to - from) * 7) / speed;
      const dir = to > from ? 1 : -1;
      look.set(withTiming(dir, { duration: 200 }));
      lean.set(withTiming(dir * 6, { duration: 200 }));
      step.set(withRepeat(withTiming(1, { duration: 120 / speed }), -1, true));
      x.set(withTiming(to, { duration: ms, easing: Easing.inOut(Easing.quad) }));
      const ok = await wait(ms);
      step.set(withTiming(0, { duration: 120 }));
      lean.set(withTiming(0, { duration: 200 }));
      return ok;
    };
    const jump = async (h = 12) => {
      hop.set(withSequence(withTiming(h, { duration: 150, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })));
      return wait(400);
    };
    const lookAround = async (quick = false) => {
      const ms = quick ? 450 : 800;
      look.set(withTiming(-1, { duration: 220 }));
      if (!(await wait(ms))) return false;
      look.set(withTiming(1, { duration: 280 }));
      if (!(await wait(ms))) return false;
      look.set(withTiming(0, { duration: 220 }));
      return wait(250);
    };
    const back = async () => {
      if (!(await walkTo(HOME_X))) return false;
      look.set(withTiming(0, { duration: 250 }));
      lookUp.set(withTiming(0, { duration: 250 }));
      setFace(rest);
      return true;
    };

    // Small things he does on his spot between outings.
    const fidget = async () => {
      if (mood === 'calm') {
        flickEar(ear);
        // Talks in his sleep, now and then.
        return chance(0.2) ? say(quip('calm'), 2200) : wait(500);
      }
      const r = Math.random();
      if (r < 0.2) flickEar(ear);
      else if (r < 0.4) {
        if (!(await lookAround(true))) return false;
      } else if (r < 0.55) {
        if (!(await jump(8))) return false;
      } else if (r < 0.75) {
        lean.set(withSequence(withTiming(-7, { duration: 160 }), withTiming(7, { duration: 220 }), withTiming(-4, { duration: 180 }), withTiming(0, { duration: 160 })));
        if (!(await wait(720))) return false;
      } else {
        // Glances up at the dial.
        lookUp.set(withTiming(1, { duration: 250 }));
        if (!(await wait(900))) return false;
        lookUp.set(withTiming(0, { duration: 250 }));
      }
      return chance(0.35) ? say(quip(mood), 2400) : true;
    };

    const stroll = async () => {
      if (!(await walkTo(between(-ROAM, ROAM)))) return false;
      if (!(await lookAround())) return false;
      if (!(await say(quip(mood)))) return false;
      return back();
    };
    const visit = async () => {
      if (!target) return stroll();
      const late = target.daysLeft < 0;
      if (!(await walkTo(underBill(target.dialDeg), late ? 1.6 : 1))) return false;
      look.set(withTiming(0, { duration: 200 }));
      lookUp.set(withTiming(1, { duration: 300 }));
      if (!(await jump(14))) return false;
      setFace('chew');
      chew.set(withRepeat(withTiming(1, { duration: 160 }), 8, true));
      if (!(await wait(1300))) return false;
      chew.set(withTiming(0, { duration: 100 }));
      setFace(late ? 'worried' : 'idle');
      const text = late ? t(pick(['billy.late', 'billy.late2'])) : target.daysLeft === 0 ? t('billy.today', { payee: target.payee }) : pick([t('billy.fresh', { payee: target.payee }), t('billy.never')]);
      if (!(await say(text))) return false;
      return back();
    };
    const dance = async () => {
      setFace('happy');
      for (const dir of [-1, 1, -1, 1]) {
        lean.set(withTiming(dir * 10, { duration: 150 }));
        if (!(await jump(10))) return false;
      }
      lean.set(withTiming(0, { duration: 150 }));
      if (!(await say(t('billy.q.dance'), 2200))) return false;
      setFace(rest);
      return true;
    };
    const spin = async () => {
      if (!(await jump(6))) return false;
      hop.set(withSequence(withTiming(18, { duration: 300, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })));
      lean.set(withTiming(360, { duration: 600, easing: Easing.inOut(Easing.quad) }));
      if (!(await wait(620))) return false;
      lean.set(0);
      return say(t('billy.q.whee'), 1800);
    };
    const trip = async () => {
      const dir = chance(0.5) ? 1 : -1;
      if (!(await walkTo(HOME_X + 60 + dir * 30, 1.4))) return false;
      lean.set(withSequence(withTiming(dir * 28, { duration: 160 }), withTiming(dir * 22, { duration: 400 }), withTiming(0, { duration: 260 })));
      setFace('worried');
      if (!(await wait(900))) return false;
      setFace('idle');
      if (!(await say(t('billy.q.meant'), 2200))) return false;
      return back();
    };
    const zoom = async () => {
      if (!(await walkTo(ROAM, 2.6))) return false;
      if (!(await jump(10))) return false;
      if (!(await walkTo(-ROAM, 2.6))) return false;
      if (!(await say(t('billy.q.zoom'), 1800))) return false;
      return back();
    };
    const wake = async () => {
      setFace('idle');
      if (!(await jump())) return false;
      if (!(await say(t('billy.up'), 1600))) return false;
      if (!(await (chance(0.5) ? stroll() : dance()))) return false;
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
      if (!(await say(t('billy.q.crunchy'), 2200))) return false;
      setFace(rest);
      return true;
    };
    const greet = async () => {
      // Points out the dial's marker while it's still showing itself off.
      if (hint && mood !== 'empty') {
        lookUp.set(withTiming(1, { duration: 250 }));
        if (!(await say(t('billy.dragHint'), 3200))) return false;
        lookUp.set(withTiming(0, { duration: 250 }));
      }
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
      if (mood === 'calm') return chance(0.65) ? wake() : say(quip('calm'), 2400);
      const tricks = [stroll, dance, spin, trip, zoom];
      if (mood === 'empty') return pick(tricks)();
      if (mood === 'late') return chance(0.6) ? visit() : pick(tricks)();
      return chance(0.4) ? visit() : pick(tricks)();
    };

    (async () => {
      if (!popped.current) {
        if (!(await wait(SWEEP_END + 300))) return;
        popped.current = true;
        pop.set(withSpring(1, { damping: 10, stiffness: 160 }));
        if (!(await wait(500))) return;
      }
      if (fed && !eaten.has(fed.id)) {
        eaten.add(fed.id);
        if (!(await eat(fed.payee))) return;
      } else if (!(await greet())) return;
      let nextOuting = Date.now() + between(8000, 14000);
      while (alive()) {
        if (!(await wait(between(2500, 5000)))) return;
        if (Date.now() - lastTouch < 3000) continue;
        if (Date.now() >= nextOuting) {
          if (!(await outing())) return;
          nextOuting = Date.now() + between(10_000, 20_000);
        } else if (!(await fidget())) return;
      }
    })();

    return () => {
      cancelled = true;
      // Back to his spot if he was out when things changed.
      x.set(withTiming(HOME_X, { duration: 500 }));
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

  useBlink(parts.lid, moving);

  const asleep = face === 'sleep';
  useEffect(() => {
    zz.set(asleep && moving ? withRepeat(withTiming(1, { duration: 2400 }), -1, false) : 0);
  }, [asleep, moving, zz]);

  useEffect(() => () => {
    if (lineTimer.current) clearTimeout(lineTimer.current);
  }, []);

  /** Says something now, outside the script (a tap, the dial being dragged). */
  const blurt = (text: string, ms = 2600, after?: () => void) => {
    setSide(sideFor(x.get()));
    setLine(text);
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => {
      setLine((l) => (l === text ? null : l));
      after?.();
    }, ms);
  };

  // Dragging the dial onto a bill: he looks up at it and has an opinion.
  const [seenPeek, setSeenPeek] = useState(peek);
  if (peek !== seenPeek) {
    setSeenPeek(peek);
    // Moved off the last bill: that remark no longer applies.
    if (seenPeek) {
      const old = t('billy.peek', { payee: seenPeek });
      setLine((l) => (l === old ? null : l));
    }
    if (peek) {
      setSide(sideFor(HOME_X));
      setLine(t('billy.peek', { payee: peek }));
    }
  }
  useEffect(() => {
    if (!peek) return;
    lookUp.set(withTiming(1, { duration: 200 }));
    flickEar(ear);
    const timer = setTimeout(() => {
      lookUp.set(withTiming(0, { duration: 300 }));
      setLine((l) => (l === t('billy.peek', { payee: peek }) ? null : l));
    }, 2200);
    return () => clearTimeout(timer);
  }, [peek, lookUp, ear]);

  const onTap = () => {
    Haptics.selectionAsync();
    hop.set(withSequence(withTiming(16, { duration: 140, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })));
    flickEar(ear);
    const text = asleep ? t('billy.up') : chance(0.5) ? t(pick(['billy.tickle', 'billy.both', 'billy.q.meh'])) : quip(mood);
    if (asleep) setFace('idle');
    blurt(text, 2600, asleep ? () => setFace('sleep') : undefined);
  };

  // Standing on the strip's floor; leaning and spinning around his feet.
  const body = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 1.5),
    transform: [
      { translateX: rowW / 2 + x.get() - W / 2 },
      { translateY: BILLY_STRIP - H - hop.get() - step.get() * 2.5 + (1 - pop.get()) * 20 },
      { translateY: H / 2 },
      { rotate: `${lean.get()}deg` },
      { translateY: -H / 2 },
    ],
  }));
  const right = side === 'right';
  const bubble = useAnimatedStyle(() => {
    const at = rowW / 2 + x.get();
    return right ? { left: at + W / 2 + 4, right: 0 } : { left: 0, right: rowW - at + W / 2 + 4 };
  });

  return (
    <View style={st.strip} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      <Animated.View pointerEvents="none" style={[st.bubbleSlot, { alignItems: right ? 'flex-start' : 'flex-end' }, bubble]}>
        <Bubble line={line} />
      </Animated.View>
      <Animated.View style={[st.body, body]}>
        <Pressable onPress={onTap} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('billy.a11y')} style={StyleSheet.absoluteFill}>
          <BillyArt face={face} parts={parts} width={W} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * Billy introducing himself in onboarding. He says hi, fidgets and chats; once `optedOut`, he takes
 * it personally, says so, and walks off the screen, then calls `onGone`.
 */
export function BillyMeet({ optedOut, onGone, size = 150 }: { optedOut: boolean; onGone: () => void; size?: number }) {
  const reduced = useReducedMotion();
  const parts = useParts();
  const { look, chew, ear } = parts;
  const hop = useSharedValue(0);
  const x = useSharedValue(0);
  const step = useSharedValue(0);
  const lean = useSharedValue(0);
  const [face, setFace] = useState<Face>('idle');
  const [line, setLine] = useState<string | null>(t('billy.hello'));

  useBlink(parts.lid, !reduced);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<boolean>((done) => setTimeout(() => done(!cancelled), ms));
    const jump = (h: number) => hop.set(withSequence(withTiming(h, { duration: 160, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 230, easing: Easing.in(Easing.quad) })));

    if (optedOut) {
      (async () => {
        setFace('sad');
        setLine(t('billy.optedOut'));
        if (!(await wait(2800))) return;
        if (reduced) return onGone();
        setLine(null);
        look.set(withTiming(1, { duration: 200 }));
        lean.set(withTiming(6, { duration: 200 }));
        step.set(withRepeat(withTiming(1, { duration: 130 }), -1, true));
        x.set(withTiming(420, { duration: 1500, easing: Easing.in(Easing.quad) }));
        if (!(await wait(1400))) return;
        onGone();
      })();
      return () => {
        cancelled = true;
      };
    }

    if (reduced) return;
    (async () => {
      jump(14);
      if (!(await wait(2400))) return;
      setLine(null);
      const lines: Key[] = ['billy.meet1', 'billy.meet2', 'billy.meet3'];
      for (let i = 0; !cancelled; i++) {
        if (!(await wait(between(1500, 3000)))) return;
        const r = Math.random();
        if (r < 0.25) flickEar(ear);
        else if (r < 0.5) look.set(withSequence(withTiming(-1, { duration: 220 }), withDelay(600, withTiming(1, { duration: 260 })), withDelay(600, withTiming(0, { duration: 220 }))));
        else if (r < 0.7) jump(10);
        else {
          setFace('chew');
          chew.set(withRepeat(withTiming(1, { duration: 150 }), 6, true));
          if (!(await wait(1000))) return;
          setFace('idle');
        }
        if (i % 2 === 1) {
          setLine(t(lines[((i - 1) / 2) % lines.length]));
          if (!(await wait(2800))) return;
          setLine(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Shared values are stable, and onGone is only called once he has left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optedOut, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: -hop.get() - step.get() * 4 }, { rotate: `${lean.get()}deg` }],
  }));

  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={{ minHeight: 56, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Bubble line={line} />
      </View>
      <Animated.View style={[{ width: size, height: size * 0.9 }, style]}>
        <Pressable
          accessibilityRole="image"
          accessibilityLabel={t('billy.a11y')}
          onPress={() => {
            Haptics.selectionAsync();
            hop.set(withSequence(withTiming(18, { duration: 140 }), withTiming(0, { duration: 220 })));
            flickEar(ear);
          }}>
          <BillyArt face={face} parts={parts} width={size} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  body: { position: 'absolute', left: 0, top: 0, width: W, height: H },
  strip: { height: BILLY_STRIP, alignSelf: 'stretch' },
  bubbleSlot: { position: 'absolute', top: 0, bottom: 14, justifyContent: 'center' },
  bubble: { maxWidth: 240, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 16, color: C.fg, textAlign: 'center' },
}));
