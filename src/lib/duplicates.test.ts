import { describe, expect, it } from 'vitest';

import { findDuplicate } from './duplicates';
import { emptyPayment, type Bill } from './types';

const bill = (id: string, payee: string, minor: number | null, dueDate: string | null, ref: string | null = null, iban: string | null = null): Bill => ({
  id,
  payee,
  description: null,
  amountMinor: minor,
  currency: 'CHF',
  dueDate,
  issueDate: null,
  category: 'other',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: { ...emptyPayment(), reference: ref, iban },
  sources: {},
  status: 'open',
  paidAt: null,
  createdAt: '2026-10-01T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
});

const draft = (payee: string, minor: number | null, dueDate: string | null, ref: string | null = null, iban: string | null = null) => {
  const { payment, ...rest } = bill('new', payee, minor, dueDate, ref, iban);
  return { ...rest, payment };
};

describe('findDuplicate', () => {
  const saved = [bill('a', 'KPT Krankenkasse AG', 38720, '2026-11-01', '21 00000 00003 13947 14300 09017'), bill('b', 'Swisscom', 6990, '2026-11-15')];

  it('spots the same bill scanned twice', () => {
    expect(findDuplicate(draft('KPT Krankenkasse', 38720, '2026-11-01'), saved)?.id).toBe('a');
    expect(findDuplicate(draft('Swisscom (Schweiz) AG', 6990, '2026-11-15'), saved)?.id).toBe('b');
  });

  it('matches on the reference when the due date is missing', () => {
    expect(findDuplicate(draft('KPT', 38720, null, '210000000003139471430009017'), saved)?.id).toBe('a');
  });

  it('matches the biller by IBAN when the names differ', () => {
    const withIban = [bill('c', 'EWZ', 12000, '2026-11-30', null, 'CH93 0076 2011 6238 5295 7')];
    expect(findDuplicate(draft('Elektrizitätswerk der Stadt Zürich', 12000, '2026-11-30', null, 'CH9300762011623852957'), withIban)?.id).toBe('c');
  });

  it('leaves next month’s bill alone', () => {
    expect(findDuplicate(draft('KPT Krankenkasse AG', 38720, '2026-12-01'), saved)).toBeNull();
  });

  it('leaves a different invoice alone', () => {
    expect(findDuplicate(draft('KPT', 38720, '2026-11-01', '999'), saved)).toBeNull();
    expect(findDuplicate(draft('KPT', 12000, '2026-11-01'), saved)).toBeNull();
  });

  it('ignores the bill being edited', () => {
    expect(findDuplicate(draft('KPT', 38720, '2026-11-01'), saved, 'a')).toBeNull();
  });
});
