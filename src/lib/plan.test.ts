import { describe, expect, it } from 'vitest';

import { nextPayday, paydayAdvice, planAroundPayday } from './plan';
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
  it('finds the coming payday', () => {
    expect(nextPayday(23, '2026-10-20')).toBe('2026-10-23'); // Fri
    expect(nextPayday(15, '2026-10-20')).toBe('2026-11-13'); // 15 Nov is a Sunday -> Fri 13
  });
  it('moves Saturday paydays to Friday and caps short months', () => {
    expect(nextPayday(25, '2026-10-20')).toBe('2026-10-23'); // Sun 25 Oct -> Fri 23
    expect(nextPayday(31, '2027-02-01')).toBe('2027-02-26'); // Sun 28 Feb -> Fri 26
  });
  it('never returns today', () => {
    expect(nextPayday(20, '2026-10-20')).toBe('2026-11-20');
  });
});

describe('planAroundPayday', () => {
  it('splits bills around the next payday', () => {
    const bills = [bill('a', 6490, '2026-10-22'), bill('b', 38720, '2026-11-01'), bill('c', 1000, '2026-10-23')];
    const p = planAroundPayday(bills, 23, 'CHF', '2026-10-20');
    expect(p.payday).toBe('2026-10-23');
    expect(p.before.map((b) => b.id)).toEqual(['a']);
    expect(p.beforeMinor).toBe(6490);
    expect(p.afterMinor).toBe(39720);
  });
  it('gives advice per bill', () => {
    expect(paydayAdvice(bill('a', 1, '2026-10-22'), 23, '2026-10-20')).toMatch(/before payday/);
    expect(paydayAdvice(bill('b', 1, '2026-11-01'), 23, '2026-10-20')).toMatch(/after payday/);
  });
});
