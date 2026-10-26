import { describe, expect, it } from 'vitest';

import { alreadyPaid, chasedBill, looksLikeDunning } from './dunning';
import { priceChange } from './price-change';
import { paidIn, paidYears, taxCsv, taxHtml, totalsByCategory } from './tax-export';
import { emptyPayment, type Bill } from './types';

const bill = (id: string, payee: string, minor: number, dueDate: string, extra: Partial<Bill> = {}): Bill => ({
  id,
  payee,
  description: null,
  amountMinor: minor,
  currency: 'CHF',
  dueDate,
  issueDate: null,
  category: 'health',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: emptyPayment(),
  sources: {},
  status: 'open',
  paidAt: null,
  createdAt: dueDate + 'T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
  ...extra,
});

describe('priceChange', () => {
  const history = [bill('a', 'KPT Krankenkasse AG', 36400, '2025-11-01'), bill('b', 'KPT', 36400, '2025-12-01'), bill('c', 'Swisscom', 6990, '2025-12-15')];

  it('compares with the biller’s previous bill', () => {
    expect(priceChange(bill('n', 'KPT Krankenkasse', 38720, '2026-01-01'), history)).toEqual({ pct: 6.4, diffMinor: 2320, previousMinor: 36400, previousDate: '2025-12-01' });
    expect(priceChange(bill('n', 'Swisscom', 5990, '2026-01-15'), history)?.pct).toBe(-14.3);
  });

  it('stays quiet for small changes, first bills and reminders', () => {
    expect(priceChange(bill('n', 'KPT', 36500, '2026-01-01'), history)).toBeNull();
    expect(priceChange(bill('n', 'Sunrise', 5000, '2026-01-01'), history)).toBeNull();
    expect(priceChange(bill('n', 'KPT', 38400, '2026-01-01', { dunning: { level: 1, feeMinor: 2000 } }), history)).toBeNull();
  });

  it('ignores bills more than a year apart', () => {
    expect(priceChange(bill('n', 'KPT', 40000, '2027-06-01'), history)).toBeNull();
  });
});

describe('dunning', () => {
  it('recognises reminders in several languages', () => {
    expect(looksLikeDunning('2. Mahnung Krankenkasse')).toBe(true);
    expect(looksLikeDunning('Sollecito di pagamento')).toBe(true);
    expect(looksLikeDunning('Mobile subscription · October')).toBe(false);
  });

  it('finds the open bill a reminder chases', () => {
    const open = [bill('a', 'KPT', 36400, '2025-11-01'), bill('b', 'KPT', 36400, '2025-10-01', { status: 'paid', paidAt: '2025-10-01T00:00:00Z' })];
    const reminder = { payee: 'KPT Krankenkasse', amountMinor: 38400, payment: emptyPayment(), dunning: { level: 1 as const, feeMinor: 2000 } };
    expect(chasedBill(reminder, open)?.id).toBe('a');
    expect(chasedBill({ ...reminder, dunning: null }, open)).toBeNull();
    expect(chasedBill({ ...reminder, amountMinor: 50000 }, open)).toBeNull();
  });

  it('notices a reminder for a bill already paid', () => {
    const paid = [bill('b', 'KPT', 36400, '2025-10-01', { status: 'paid', paidAt: '2025-10-01T00:00:00Z', payment: { ...emptyPayment(), reference: '21 00000 00003 13947' } })];
    const reminder = { payee: 'KPT', amountMinor: 38400, payment: { ...emptyPayment(), reference: '210000000003139 47' }, dunning: { level: 1 as const, feeMinor: 2000 } };
    expect(alreadyPaid(reminder, paid)?.id).toBe('b');
    expect(chasedBill(reminder, paid)).toBeNull();
  });
});

describe('tax export', () => {
  const paid = (id: string, payee: string, minor: number, paidAt: string, extra: Partial<Bill> = {}) => bill(id, payee, minor, paidAt.slice(0, 10), { status: 'paid', paidAt, ...extra });
  const bills = [
    paid('a', 'KPT', 38720, '2026-01-28T09:00:00Z'),
    paid('b', 'Zahnarzt Meier; Praxis', 24000, '2026-03-02T09:00:00Z'),
    paid('c', 'Swisscom', 6990, '2026-02-10T09:00:00Z', { category: 'telecom', paidAmountMinor: 6850 }),
    paid('d', 'KPT', 36400, '2025-12-20T09:00:00Z'),
    bill('e', 'EWZ', 12000, '2026-04-01'),
  ];

  it('picks the year by payment date', () => {
    expect(paidYears(bills)).toEqual([2026, 2025]);
    expect(paidIn(bills, 2026).map((b) => b.id)).toEqual(['a', 'c', 'b']);
  });

  it('totals per category using what was actually paid', () => {
    expect(totalsByCategory(paidIn(bills, 2026))).toEqual([
      { category: 'health', currency: 'CHF', minor: 62720, count: 2 },
      { category: 'telecom', currency: 'CHF', minor: 6850, count: 1 },
    ]);
  });

  it('writes a spreadsheet Excel opens', () => {
    const csv = taxCsv(paidIn(bills, 2026), { categoryLabel: (c) => c, semicolon: true });
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('2026-01-28;2026-01-28;KPT;;health;387.20;CHF;;');
    expect(lines[3]).toContain('"Zahnarzt Meier; Praxis"');
    expect(lines[2]).toContain(';68.50;');
  });

  it('prints a summary', () => {
    const html = taxHtml(paidIn(bills, 2026), 2026, { categoryLabel: (c) => c, generatedOn: '1 Jan 2027' });
    expect(html).toContain('2026');
    expect(html).toContain('Zahnarzt Meier; Praxis');
  });
});
