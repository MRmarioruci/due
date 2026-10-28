import { describe, expect, it } from 'vitest';

import { billyMood, freshBill, ROAM, underBill } from './billy';
import type { Bill } from './types';

describe('billy', () => {
  it('walks to right under a bill, as far as the strip goes', () => {
    expect(underBill(0)).toBeCloseTo(0);
    expect(underBill(-150)).toBeCloseTo(-59);
    expect(underBill(90)).toBe(ROAM - 7 > 118 ? 118 : Math.min(118, ROAM));
    expect(underBill(-90, 200)).toBe(-ROAM);
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
