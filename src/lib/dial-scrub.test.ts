import { describe, expect, it } from 'vitest';

import { dayAtPoint, snapDay, stepBillDay } from './dial-scrub';

describe('dial scrub', () => {
  const c = 170;
  const at = (deg: number, r = 130) => [c + r * Math.sin((deg * Math.PI) / 180), c - r * Math.cos((deg * Math.PI) / 180)] as const;

  it('reads today at the lower left, mid-month at the top, the last day at the lower right', () => {
    expect(dayAtPoint(...at(-150), c, 30)).toBeCloseTo(0);
    expect(dayAtPoint(...at(0), c, 30)).toBeCloseTo(15);
    expect(dayAtPoint(...at(150), c, 30)).toBeCloseTo(30);
  });

  it('clamps the open gap at the bottom to its ends', () => {
    expect(dayAtPoint(...at(-170), c, 30)).toBe(0);
    expect(dayAtPoint(...at(170), c, 30)).toBe(30);
  });

  it('snaps to a nearby bill, else to the whole day', () => {
    expect(snapDay(8.6, [3, 9, 21])).toBe(9);
    expect(snapDay(12.4, [3, 9, 21])).toBe(12);
  });

  it('steps from bill to bill', () => {
    expect(stepBillDay(0, [9, 3, 21], 1)).toBe(3);
    expect(stepBillDay(9, [9, 3, 21], -1)).toBe(3);
    expect(stepBillDay(21, [9, 3, 21], 1)).toBe(21);
  });
});
