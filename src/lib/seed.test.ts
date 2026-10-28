import { describe, expect, it, vi } from 'vitest';

import { sampleBills } from './seed';

// vi.mock is hoisted above the imports. The seed module also saves; only the pure part is tested here.
vi.mock('./settings', () => ({ getSettings: () => ({}), homeCountry: () => 'CH', homeCurrency: () => 'CHF', updateSettings: () => {} }));
vi.mock('./store', () => ({ deleteBill: () => {}, getBills: () => [], saveBill: () => {} }));

describe('sample bills', () => {
  const today = '2026-10-27';
  const bills = sampleBills(today, 'CHF', 'CH', Date.parse('2026-10-27T10:00:00Z'));

  it('pays the past and leaves the next weeks open', () => {
    expect(bills.filter((b) => b.dueDate && b.dueDate < today).every((b) => b.status === 'paid')).toBe(true);
    expect(bills.filter((b) => b.dueDate && b.dueDate >= today).every((b) => b.status === 'open')).toBe(true);
    expect(bills.filter((b) => b.status === 'open').map((b) => b.payee)).toEqual(expect.arrayContaining(['Livit AG', 'Helsana', 'SBB', 'Serafe']));
  });

  it('has rent every month, utilities every quarter', () => {
    expect(bills.filter((b) => b.payee === 'Livit AG').map((b) => b.dueDate)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']);
    expect(bills.filter((b) => b.payee === 'EWZ').map((b) => b.dueDate)).toEqual(['2026-07-20', '2026-10-20']);
  });

  it('has everyday receipts, already paid and with no due date', () => {
    const receipts = bills.filter((b) => b.kind === 'receipt');
    expect(receipts.length).toBeGreaterThan(20);
    expect(receipts.every((b) => b.status === 'paid' && b.dueDate == null && b.paidAt! <= '2026-10-27T23:59')).toBe(true);
  });

  it('adds up to a believable month on CHF 8’000', () => {
    const october = bills.filter((b) => b.dueDate?.startsWith('2026-10')).reduce((s, b) => s + b.amountMinor!, 0);
    expect(october).toBeGreaterThan(250000);
    expect(october).toBeLessThan(400000);
    expect(new Set(bills.map((b) => b.id)).size).toBe(bills.length);
  });
});
