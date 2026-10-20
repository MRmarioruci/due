import { describe, expect, it } from 'vitest';

import { computeStats } from './stats';
import { emptyPayment, type Bill } from './types';

const bill = (minor: number, paidAt: string, dueDate: string, currency = 'CHF'): Bill => ({
  id: paidAt + minor,
  payee: 'x',
  description: null,
  amountMinor: minor,
  currency,
  dueDate,
  issueDate: null,
  category: 'insurance',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: emptyPayment(),
  sources: {},
  status: 'paid',
  paidAt,
  createdAt: paidAt,
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
});

describe('computeStats', () => {
  const now = new Date(2026, 9, 20, 12);
  const bills = [
    bill(10000, new Date(2026, 9, 5).toISOString(), '2026-10-08'), // 3 days early
    bill(5000, new Date(2026, 9, 12).toISOString(), '2026-10-10'), // 2 days late
    bill(20000, new Date(2026, 8, 3).toISOString(), '2026-09-05'),
    bill(999, new Date(2026, 9, 6).toISOString(), '2026-10-06', 'EUR'),
  ];

  it('sums the main currency per month', () => {
    const s = computeStats(bills, 'month', now);
    expect(s.currency).toBe('CHF');
    expect(s.buckets).toHaveLength(6);
    expect(s.buckets[5].minor).toBe(15000);
    expect(s.buckets[4].minor).toBe(20000);
  });

  it('counts on-time payments and days early in the current period', () => {
    const s = computeStats(bills, 'month', now);
    expect(s.paidCount).toBe(3);
    expect(s.onTime).toBe(2);
    expect(s.avgDaysEarly).toBeCloseTo((3 - 2 + 0) / 3);
  });
});
