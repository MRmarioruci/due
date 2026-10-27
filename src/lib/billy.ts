import type { Bill } from './types';

/**
 * Billy, the goat on the home dial. He walks along the inside of the ring, upright to it: his track
 * angle is 180 at the bottom of the dial (his seat, in the gap), growing towards today's side.
 */
export type BillyMood = 'empty' | 'calm' | 'focus' | 'late';

export const SEAT = 180;
/** How far up the ring he climbs either way; beyond this he'd be standing on the wall. */
export const REACH = 45;

/** A dial angle (−150° today … +150° the last day) as an angle on Billy's track. */
export const trackAngle = (dialDeg: number) => (dialDeg + 360) % 360;

/** Where he stands to nibble the bill at track angle `a`: a step short of it, as high as he can climb. */
export function standBeside(a: number): number {
  const at = a >= SEAT ? a - 11 : a + 11;
  return Math.min(SEAT + REACH, Math.max(SEAT - REACH, at));
}

export function billyMood(kind: 'empty' | 'calm' | 'focus', daysLeft: number): BillyMood {
  if (kind !== 'focus') return kind;
  return daysLeft < 0 ? 'late' : 'focus';
}

/** The newest bill if it was saved in the last few minutes: a meal Billy hasn't had yet. */
export function freshBill(bills: Bill[], now = Date.now(), within = 10 * 60_000): Bill | null {
  let newest: Bill | null = null;
  for (const b of bills) if (!newest || b.createdAt > newest.createdAt) newest = b;
  if (!newest) return null;
  const age = now - Date.parse(newest.createdAt);
  return age >= 0 && age < within ? newest : null;
}
