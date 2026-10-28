import * as Haptics from 'expo-haptics';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, makeMutable, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n/core';
import { formatAmount } from '@/lib/money';
import { markPaid } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import type { Bill } from '@/lib/types';

import { BillyArt, Bubble, Burst, feedStore, flickEar, useBlink, useParts, type Face } from './billy';
import { C, F, themed } from './theme';

/**
 * Feeding Billy: long-press an open bill and he drops in at the top with his mouth open. Drag the
 * bill into it and he eats it, which marks it paid; let go anywhere else and it goes back.
 */
const BW = 112;
const BH = BW * 0.9;
export const FEED_HOLD_MS = 380;

// Written by the gesture on the UI thread, read by the floating card: where the card is (top-left,
// screen px), where it started, and where his mouth is (set by the host once it knows the screen).
const cardX = makeMutable(0);
const cardY = makeMutable(0);
const startX = makeMutable(0);
const startY = makeMutable(0);
const mouthX = makeMutable(0);
const mouthY = makeMutable(0);
const over = makeMutable(0);

const useFeed = () => useSyncExternalStore(feedStore.subscribe, feedStore.get);

function begin(bill: Bill, x: number, y: number, w: number, h: number) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  feedStore.set({ bill, from: { x, y, w, h }, outcome: null, returned: false });
}

function release() {
  const f = feedStore.get();
  if (f && !f.outcome) feedStore.set({ ...f, outcome: over.get() > 0.5 ? 'eat' : 'miss' });
}

/** Wraps a bill row so a long press picks it up for Billy. Only open bills, and only with Billy on. */
export function FeedableRow({ bill, children }: { bill: Bill; children: ReactNode }) {
  const { billy } = useSettings();
  const f = useFeed();
  const [size, setSize] = useState({ w: 0, h: 0 });
  // The row stays in the list as a gap while its card is up in the air.
  const lifted = f?.bill.id === bill.id && !f.returned;

  const { w, h } = size;
  const pan = Gesture.Pan()
    .activateAfterLongPress(FEED_HOLD_MS)
    .onStart((e) => {
      const x = e.absoluteX - e.x;
      const y = e.absoluteY - e.y;
      startX.set(x);
      startY.set(y);
      cardX.set(x);
      cardY.set(y);
      over.set(0);
      runOnJS(begin)(bill, x, y, w, h);
    })
    .onUpdate((e) => {
      const x = startX.get() + e.translationX;
      const y = startY.get() + e.translationY;
      cardX.set(x);
      cardY.set(y);
      // Over his mouth: the card's middle near his, and its top up by his chin.
      over.set(Math.abs(x + w / 2 - mouthX.get()) < 110 && y < mouthY.get() + 40 ? 1 : 0);
    })
    .onFinalize((_, ok) => {
      if (ok) runOnJS(release)();
    });

  if (bill.status !== 'open' || !billy) return children;
  return (
    <GestureDetector gesture={pan}>
      <View onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={lifted && { opacity: 0 }}>
        {children}
      </View>
    </GestureDetector>
  );
}

/** Mounted once over the whole app: Billy at the top and the bill being dragged to him. */
export function BillyFeedHost() {
  const f = useFeed();
  if (!f) return null;
  return <FeedPlay key={f.bill.id} feed={f} />;
}

function FeedPlay({ feed: f }: { feed: NonNullable<ReturnType<typeof feedStore.get>> }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const top = insets.top + 14;
  const parts = useParts();
  const { chew, ear } = parts;
  const [face, setFace] = useState<Face>('gape');
  const [line, setLine] = useState<string | null>(t('billy.feed.ask'));
  const [bursts, setBursts] = useState<number[]>([]);
  const drop = useSharedValue(-(top + BH + 30));
  const hop = useSharedValue(0);
  const gulp = useSharedValue(0);
  const home = useSharedValue(0);
  const { w, h } = f.from;

  useBlink(parts.lid, true);

  // He drops in from above and tells the card where his mouth is.
  useEffect(() => {
    mouthX.set(width / 2);
    mouthY.set(top + BH * 0.8);
    drop.set(withSpring(0, { damping: 13, stiffness: 180 }));
  }, [width, top, drop]);

  // Getting close: he gets excited; moving away: back to waiting.
  const near = (yes: boolean) => {
    if (f.outcome) return;
    if (yes) {
      Haptics.selectionAsync();
      flickEar(ear);
      setLine(t('billy.feed.close'));
    } else setLine(t('billy.feed.ask'));
  };

  useAnimatedReaction(
    () => over.get(),
    (now, before) => {
      if (before != null && now !== before) runOnJS(near)(now > 0.5);
    },
  );

  useEffect(() => {
    if (!f.outcome) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<boolean>((ok) => setTimeout(() => ok(!cancelled), ms));
    const leave = async () => {
      setLine(null);
      drop.set(withTiming(-(top + BH + 40), { duration: 320, easing: Easing.in(Easing.quad) }));
      if (await wait(340)) feedStore.set(null);
    };
    (async () => {
      if (f.outcome === 'eat') {
        gulp.set(withTiming(1, { duration: 300, easing: Easing.in(Easing.quad) }));
        if (!(await wait(300))) return;
        setFace('chew');
        chew.set(withRepeat(withTiming(1, { duration: 140 }), 10, true));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await markPaid(f.bill);
        setLine(t('billy.feed.nom', { payee: f.bill.payee }));
        if (!(await wait(1400))) return;
        setFace('happy');
        setBursts([Date.now()]);
        hop.set(withSequence(withTiming(16, { duration: 150, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })));
        setLine(t('billy.feed.paid'));
        if (!(await wait(1500))) return;
        return leave();
      }
      // Missed: the card flies home and he sulks.
      cardX.set(withSpring(f.from.x, { damping: 16, stiffness: 180 }));
      cardY.set(withSpring(f.from.y, { damping: 16, stiffness: 180 }));
      setFace('sad');
      setLine(t('billy.feed.aw'));
      if (!(await wait(450))) return;
      home.set(1);
      feedStore.set({ ...f, returned: true });
      if (!(await wait(700))) return;
      return leave();
    })();
    return () => {
      cancelled = true;
    };
    // Plays once per outcome; shared values are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.outcome]);

  const billyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.get() - hop.get() }] }));
  // The card follows the finger; once fed it shrinks into his mouth.
  const card = useAnimatedStyle(() => {
    const g = gulp.get();
    const x = cardX.get() + (mouthX.get() - w / 2 - cardX.get()) * g;
    const y = cardY.get() + (mouthY.get() - h / 2 - cardY.get()) * g;
    return {
      opacity: home.get() ? 0 : 1 - g * g * g,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${-3 * (1 - g)}deg` }, { scale: (over.get() ? 0.9 : 1.03) * (1 - 0.9 * g) }],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[st.card, { width: w, height: h }, card]}>
        <Text style={st.payee} numberOfLines={1}>
          {f.bill.payee}
        </Text>
        <Text style={st.amount} numberOfLines={1}>
          {f.bill.currency} {formatAmount(f.bill.amountMinor, f.bill.currency)}
        </Text>
      </Animated.View>
      {bursts.map((id) => (
        <Burst key={id} x={width / 2} bottom={height - (top + BH * 0.8)} />
      ))}
      <Animated.View style={[st.billy, { top, left: (width - BW) / 2 }, billyStyle]}>
        <BillyArt face={face} parts={parts} width={BW} />
      </Animated.View>
      <Animated.View style={[st.bubble, { top: top + BH + 10 }, billyStyle]}>
        <Bubble line={line} />
      </Animated.View>
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  card: { position: 'absolute', left: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, backgroundColor: C.paper, borderWidth: 1, borderColor: '#c9c6be', elevation: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  payee: { flex: 1, fontFamily: F.semibold, fontSize: 16, color: '#0a0a0a' },
  amount: { fontFamily: F.mono, fontSize: 14, color: '#0a0a0a' },
  billy: { position: 'absolute', width: BW, height: BH },
  bubble: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
}));
