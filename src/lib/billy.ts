import type { Bill } from './types';

/**
 * Billy, the goat under the home dial. He lives on a strip below it and walks left and right along
 * it; his spot is towards the left, so what he says fits on his right.
 */
export type BillyMood = 'empty' | 'calm' | 'focus' | 'late';

/** His spot on the strip, and how far either way from its middle he walks, in px. */
export const HOME_X = -100;
export const ROAM = 125;

/** Where on the strip is right under a bill on the dial (dial angle in degrees, bills at radius `r`). */
export function underBill(dialDeg: number, r = 118): number {
  return Math.max(-ROAM, Math.min(ROAM, r * Math.sin((dialDeg * Math.PI) / 180)));
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
