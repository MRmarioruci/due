import { describe, expect, it } from 'vitest';

import { moneyKept, type KeptEvent } from './kept';
import { emptyPayment, type Bill } from './types';

const paid = (amountMinor: number, paidAmountMinor: number | null, paidAt: string, currency = 'CHF'): Bill => ({
  id: paidAt + amountMinor,
  payee: 'Biller',
  description: null,
  amountMinor,
  paidAmountMinor,
  currency,
  dueDate: null,
  issueDate: null,
  category: 'other',
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

describe('money kept', () => {
  it('adds discounts, duplicates and double payments for the year', () => {
    const bills = [paid(10000, 9800, '2026-03-01T10:00:00Z'), paid(5000, null, '2026-04-01T10:00:00Z'), paid(10000, 9000, '2025-12-01T10:00:00Z'), paid(10000, 9000, '2026-05-01T10:00:00Z', 'EUR')];
    const events: KeptEvent[] = [
      { kind: 'duplicate', minor: 11915, currency: 'CHF', at: '2026-10-26T19:00:00Z' },
      { kind: 'double', minor: 4500, currency: 'CHF', at: '2026-06-01T10:00:00Z' },
      { kind: 'duplicate', minor: 999, currency: 'CHF', at: '2025-06-01T10:00:00Z' },
    ];
    expect(moneyKept(bills, events, 2026, 'CHF')).toEqual({
      totalMinor: 200 + 11915 + 4500,
      discountsMinor: 200,
      duplicates: { n: 1, minor: 11915 },
      doubles: { n: 1, minor: 4500 },
    });
  });
});
