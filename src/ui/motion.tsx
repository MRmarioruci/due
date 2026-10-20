import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

// Reanimated follows the phone's "reduce motion" setting for all of these by default.

const EASE = Easing.out(Easing.cubic);

/** Rows and sections slide in, staggered by position; capped so long lists don't wait. */
export const enterRow = (index: number) => FadeInDown.delay(Math.min(index, 10) * 35).duration(320).easing(EASE);
export const enterFade = (delay = 0) => FadeIn.delay(delay).duration(380);
export const moveRow = LinearTransition.duration(260).easing(EASE);

/** A bar that grows from 0 to `height` px (vertical) or `fraction` of its track (horizontal). */
export function GrowBar({ size, delay = 0, horizontal = false, style }: { size: number; delay?: number; horizontal?: boolean; style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(size, { duration: 520, easing: EASE }));
  }, [size, delay, v]);
  const animated = useAnimatedStyle(() => (horizontal ? { width: `${v.value * 100}%` } : { height: v.value }));
  return <Animated.View style={[style, animated]} />;
}

/** Counts a number up from where it was to `target` over ~0.6 s (for the big totals). */
export function useCountUp(target: number, duration = 600): number {
  const [shown, setShown] = useState(target);
  const [from, setFrom] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setFrom(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `from` is only the starting point of the next run, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return shown;
}

export { Animated };
