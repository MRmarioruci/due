import { describe, expect, it } from 'vitest';

import { pickCategory } from './categorize';
import { findDuplicate } from './duplicates';
import { billPaidBy, detectKind, receiptPaidAt } from './kind';
import { priceChange } from './price-change';
import { computeStats } from './stats';
import { paidYears } from './tax-export';
import { emptyPayment, type Bill } from './types';

const entry = (over: Partial<Bill>): Bill => ({
  id: Math.random().toString(36).slice(2),
  kind: 'bill',
  payee: 'x',
  description: null,
  amountMinor: 1000,
  currency: 'EUR',
  dueDate: null,
  issueDate: null,
  category: 'other',
  country: 'GR',
  payMethod: 'bank_transfer',
  payment: emptyPayment(),
  sources: {},
  status: 'open',
  paidAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
  ...over,
});

const hints = { paymentCode: false, payee: '', learned: {} };

describe('detectKind', () => {
  it('a payment code always means a bill', () => {
    expect(detectKind({ ...hints, payee: 'Lidl', paymentCode: true, model: 'receipt' })).toBe('bill');
  });

  it('follows the reader when it says', () => {
    expect(detectKind({ ...hints, payee: 'Acme', model: 'receipt' })).toBe('receipt');
    expect(detectKind({ ...hints, payee: 'Lidl', model: 'bill' })).toBe('bill');
  });

  it("the user's correction for a shop wins over everything", () => {
    expect(detectKind({ ...hints, payee: 'Lidl Hellas', paymentCode: true, learned: { lidl: 'receipt' } })).toBe('receipt');
  });

  it('without the reader: payment details or a due date mean a bill', () => {
    expect(detectKind({ ...hints, payee: 'DEI', iban: 'GR1601101250000000012300695' })).toBe('bill');
    expect(detectKind({ ...hints, payee: 'Cosmote', dueDate: '2026-11-10' })).toBe('bill');
    expect(detectKind({ ...hints, payee: 'Acme', description: 'Rechnung November' })).toBe('bill');
  });

  it('without the reader: shops and till wording mean a receipt', () => {
    expect(detectKind({ ...hints, payee: 'Sklavenitis' })).toBe('receipt');
    expect(detectKind({ ...hints, payee: 'Shell Kifisias' })).toBe('receipt');
    expect(detectKind({ ...hints, payee: 'Το Μπαλκόνι', description: 'Απόδειξη λιανικής' })).toBe('receipt');
  });

  it('health insurers are not mistaken for a till ("Kasse")', () => {
    expect(detectKind({ ...hints, payee: 'KPT Krankenkasse' })).toBe('bill');
  });

  it('unknown and clueless: a bill, as before', () => {
    expect(detectKind({ ...hints, payee: 'Acme' })).toBe('bill');
  });
});

describe('receiptPaidAt', () => {
  const now = new Date(2026, 9, 28, 18, 0);
  it('uses the printed date and time', () => {
    const at = new Date(receiptPaidAt('2026-10-25', '19:42', now));
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([25, 19, 42]);
  });
  it('noon without a time, so the day never shifts', () => {
    expect(new Date(receiptPaidAt('2026-10-25', null, now)).getHours()).toBe(12);
  });
  it('a future or missing date is today', () => {
    expect(receiptPaidAt('2027-01-01', null, now)).toBe(now.toISOString());
    expect(receiptPaidAt(null, null, now)).toBe(now.toISOString());
  });
});

describe('receipts in the rest of the app', () => {
  it('a receipt for an open bill is its payment', () => {
    const open = entry({ payee: 'DEI', amountMinor: 8450 });
    expect(billPaidBy({ payee: 'DEI', amountMinor: 8450, currency: 'EUR' }, [open])).toBe(open);
    expect(billPaidBy({ payee: 'DEI', amountMinor: 8000, currency: 'EUR' }, [open])).toBeNull();
    expect(billPaidBy({ payee: 'DEI', amountMinor: 8450, currency: 'EUR' }, [{ ...open, status: 'paid' }])).toBeNull();
  });

  it('the same receipt scanned twice is a duplicate; another day is not', () => {
    const saved = entry({ kind: 'receipt', payee: 'Lidl', amountMinor: 4320, issueDate: '2026-10-25', time: '10:05', status: 'paid' });
    const draft = { kind: 'receipt' as const, payee: 'LIDL', amountMinor: 4320, dueDate: null, issueDate: '2026-10-25', time: '10:05', payment: emptyPayment() };
    expect(findDuplicate(draft, [saved])).toBe(saved);
    expect(findDuplicate({ ...draft, issueDate: '2026-10-26' }, [saved])).toBeNull();
    expect(findDuplicate({ ...draft, time: '18:30' }, [saved])).toBeNull();
  });

  it('receipts get no price-change line and are not compared with bills', () => {
    const a = entry({ kind: 'receipt', payee: 'Lidl', amountMinor: 3000, issueDate: '2026-10-01', createdAt: '2026-10-01T10:00:00Z' });
    const b = entry({ kind: 'receipt', payee: 'Lidl', amountMinor: 5000, issueDate: '2026-10-08', createdAt: '2026-10-08T10:00:00Z' });
    expect(priceChange(b, [a, b])).toBeNull();
  });

  it('stats split bills and everyday spending; on-time counts only bills', () => {
    const now = new Date(2026, 9, 28, 12);
    const bills = [
      entry({ status: 'paid', amountMinor: 10000, dueDate: '2026-10-05', paidAt: new Date(2026, 9, 10).toISOString() }), // late
      entry({ kind: 'receipt', status: 'paid', amountMinor: 4000, paidAt: new Date(2026, 9, 12).toISOString(), category: 'groceries' }),
      entry({ kind: 'receipt', status: 'paid', amountMinor: 1500, paidAt: new Date(2026, 9, 20).toISOString(), category: 'dining' }),
    ];
    const s = computeStats(bills, 'month', now);
    expect(s.buckets.at(-1)!.minor).toBe(15500);
    expect(s.billsMinor).toBe(10000);
    expect(s.receiptsMinor).toBe(5500);
    expect(s.receiptCount).toBe(2);
    expect(s.paidCount).toBe(1);
    expect(s.onTime).toBe(0);
    expect(s.categories.map((c) => c.category)).toEqual(['other', 'groceries', 'dining']);
  });

  it('the tax export stays bills only', () => {
    expect(paidYears([entry({ kind: 'receipt', status: 'paid', paidAt: '2025-03-01T12:00:00Z' })])).toEqual([]);
  });

  it("a receipt's category comes from the shop name first", () => {
    expect(pickCategory({ kind: 'receipt', payee: 'Lidl Hellas', model: 'shopping', learned: {} })).toBe('groceries');
    expect(pickCategory({ kind: 'receipt', payee: 'Shop 42', model: 'health', learned: {} })).toBe('shopping');
    expect(pickCategory({ kind: 'receipt', payee: 'Acme', model: 'health', learned: {} })).toBe('health');
  });
});
