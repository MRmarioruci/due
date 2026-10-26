import { describe, expect, it } from 'vitest';

import { monthFlow, yearFlow } from './flow';
import { emptyPayment, type Bill, type Category } from './types';

let n = 0;
const bill = (payee: string, category: Category, minor: number, dueDate: string, currency = 'CHF'): Bill => ({
  id: `b${n++}`,
  payee,
  description: null,
  amountMinor: minor,
  currency,
  dueDate,
  issueDate: null,
  category,
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: emptyPayment(),
  sources: {},
  status: 'paid',
  paidAt: dueDate + 'T08:00:00Z',
  createdAt: dueDate + 'T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
});

const bills = [
  bill('Livit', 'housing', 185000, '2026-09-30'),
  bill('Livit', 'housing', 185000, '2026-10-30'),
  bill('Helsana', 'health', 38720, '2026-09-01'),
  bill('Helsana', 'health', 38720, '2026-10-01'),
  bill('Serafe', 'fees', 33500, '2025-10-10'),
  bill('Serafe', 'fees', 33500, '2026-10-10'),
  bill('Swisscom', 'telecom', 6490, '2026-09-23'),
  bill('Swisscom', 'telecom', 6490, '2026-10-23'),
  bill('Zahnarzt', 'health', 24000, '2026-10-12'),
  bill('Booking', 'other', 50000, '2026-10-05', 'EUR'),
];

describe('where income goes', () => {
  it('counts regular bills at their monthly share, plus this month’s one-offs', () => {
    const f = monthFlow(bills, 620000, 'CHF', '2026-10-26');
    expect(f.billsMinor).toBe(185000 + 38720 + Math.round(33500 / 12) + 6490 + 24000);
    expect(f.leftMinor).toBe(620000 - f.billsMinor);
    expect(f.groups.map((g) => g.key)).toEqual(['housing', 'health', 'other']);
    expect(f.groups[1].rows.map((r) => [r.payee, r.cadence])).toEqual([
      ['Helsana', 'monthly'],
      ['Zahnarzt', null],
    ]);
    // Fees and telecom are small, so they share "everything else".
    expect(f.groups[2].rows.map((r) => r.payee)).toEqual(['Swisscom', 'Serafe']);
  });

  it('adds up the year so far against that many months of income', () => {
    const f = yearFlow(bills, 620000, 'CHF', '2026-10-26');
    expect(f.incomeMinor).toBe(620000 * 10);
    // October's rent is due on the 30th, after today, so it isn't counted yet.
    expect(f.billsMinor).toBe(185000 + 2 * 38720 + 33500 + 2 * 6490 + 24000);
  });

  it('can go over income', () => {
    expect(monthFlow(bills, 100000, 'CHF', '2026-10-26').leftMinor).toBeLessThan(0);
  });
});
