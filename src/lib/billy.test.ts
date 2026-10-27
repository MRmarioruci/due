import { describe, expect, it } from 'vitest';

import { billyMood, freshBill, REACH, SEAT, standBeside, trackAngle } from './billy';
import type { Bill } from './types';

describe('billy', () => {
  it('puts today on the left of his seat and the last day on the right', () => {
    expect(trackAngle(-150)).toBe(210);
    expect(trackAngle(150)).toBe(150);
  });

  it('stands a step short of a bill, never higher than he can climb', () => {
    expect(standBeside(210)).toBe(199);
    expect(standBeside(150)).toBe(161);
    expect(standBeside(300)).toBe(SEAT + REACH);
    expect(standBeside(60)).toBe(SEAT - REACH);
  });

  it('worries about overdue bills', () => {
    expect(billyMood('focus', -2)).toBe('late');
    expect(billyMood('focus', 0)).toBe('focus');
    expect(billyMood('calm', 0)).toBe('calm');
  });

  it('only eats a bill saved in the last few minutes', () => {
    const now = Date.parse('2026-10-27T10:00:00Z');
    const bill = (id: string, createdAt: string) => ({ id, createdAt }) as Bill;
    const bills = [bill('a', '2026-10-20T10:00:00Z'), bill('b', '2026-10-27T09:58:00Z')];
    expect(freshBill(bills, now)?.id).toBe('b');
    expect(freshBill([bills[0]], now)).toBeNull();
    expect(freshBill([], now)).toBeNull();
  });
});
