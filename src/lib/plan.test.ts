import { describe, expect, it } from 'vitest';

import { describePay, nextPayday, paydayAdvice, planAroundPayday } from './plan';
import { emptyPayment, type Bill } from './types';

const bill = (id: string, minor: number, dueDate: string): Bill => ({
  id,
  payee: id,
  description: null,
  amountMinor: minor,
  currency: 'CHF',
  dueDate,
  issueDate: null,
  category: 'other',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: emptyPayment(),
  sources: {},
  status: 'open',
  paidAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
});

describe('nextPayday', () => {
  const monthly = (day: number) => ({ every: 'month' as const, day });
  it('finds the coming monthly payday', () => {
    expect(nextPayday(monthly(23), '2026-10-20')).toBe('2026-10-23'); // Fri
    expect(nextPayday(monthly(15), '2026-10-20')).toBe('2026-11-13'); // 15 Nov is a Sunday -> Fri 13
  });
  it('moves weekend monthly paydays to Friday and caps short months', () => {
    expect(nextPayday(monthly(25), '2026-10-20')).toBe('2026-10-23'); // Sun 25 Oct -> Fri 23
    expect(nextPayday(monthly(31), '2027-02-01')).toBe('2027-02-26'); // Sun 28 Feb -> Fri 26
  });
  it('never returns today', () => {
    expect(nextPayday(monthly(20), '2026-10-20')).toBe('2026-11-20');
    expect(nextPayday({ every: 'week', weekday: 2 }, '2026-10-20')).toBe('2026-10-27'); // Tue -> next Tue
  });
  it('handles daily, weekly and fortnightly pay', () => {
    expect(nextPayday({ every: 'day' }, '2026-10-20')).toBe('2026-10-21');
    expect(nextPayday({ every: 'week', weekday: 5 }, '2026-10-20')).toBe('2026-10-23'); // Fri
    expect(nextPayday({ every: '2weeks', next: '2026-10-09' }, '2026-10-20')).toBe('2026-10-23'); // 9 + 14
    expect(nextPayday({ every: '2weeks', next: '2026-11-06' }, '2026-10-20')).toBe('2026-10-23'); // anchor in the future
    expect(nextPayday({ every: '2weeks', next: '2026-10-06' }, '2026-10-20')).toBe('2026-11-03'); // 20 Oct itself is a payday
  });
  it('describes the schedule', () => {
    expect(describePay({ every: 'month', day: 25 })).toBe('25th of every month');
    expect(describePay({ every: 'week', weekday: 5 })).toBe('Every Friday');
    expect(describePay({ every: '2weeks', next: '2026-10-23' })).toBe('Every other Friday');
  });
});

describe('planAroundPayday', () => {
  it('splits bills around the next payday', () => {
    const bills = [bill('a', 6490, '2026-10-22'), bill('b', 38720, '2026-11-01'), bill('c', 1000, '2026-10-23')];
    const p = planAroundPayday(bills, { every: 'month', day: 23 }, 'CHF', '2026-10-20');
    expect(p.payday).toBe('2026-10-23');
    expect(p.before.map((b) => b.id)).toEqual(['a']);
    expect(p.beforeMinor).toBe(6490);
    expect(p.afterMinor).toBe(39720);
  });
  it('gives advice per bill', () => {
    expect(paydayAdvice(bill('a', 1, '2026-10-22'), { every: 'month', day: 23 }, '2026-10-20')).toMatch(/before payday/);
    expect(paydayAdvice(bill('b', 1, '2026-11-01'), { every: 'month', day: 23 }, '2026-10-20')).toMatch(/after payday/);
  });
});
