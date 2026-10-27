import { describe, expect, it } from 'vitest';

import { allDayLocal, allDayUtc, billEvent, eventSig } from './calendar-event';
import { emptyPayment, type Bill } from './types';

const bill: Bill = {
  id: 'b1',
  payee: 'Swisscom',
  description: 'Mobile · October',
  amountMinor: 6490,
  currency: 'CHF',
  dueDate: '2026-10-30',
  issueDate: null,
  category: 'telecom',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: { ...emptyPayment(), iban: 'CH4431999123000889012', reference: '210000000003139471430009017' },
  sources: {},
  status: 'open',
  paidAt: null,
  createdAt: '2026-10-01T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
};

describe('bills in the calendar', () => {
  it('become an all-day event on the due date with what’s needed to pay', () => {
    const e = billEvent(bill)!;
    expect(e.date).toBe('2026-10-30');
    expect(e.title).toContain('Swisscom');
    expect(e.title).toContain('64.90');
    expect(e.notes).toContain('CH4431999123000889012');
    expect(e.notes).toContain('210000000003139471430009017');
    expect(billEvent({ ...bill, dueDate: null })).toBeNull();
  });

  it('use UTC midnights for the calendar provider and local ones for the form', () => {
    const utc = allDayUtc('2026-10-30');
    expect(utc.startDate.toISOString()).toBe('2026-10-30T00:00:00.000Z');
    expect(utc.endDate.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    const local = allDayLocal('2026-10-30');
    expect([local.startDate.getDate(), local.startDate.getHours(), local.endDate.getDate()]).toEqual([30, 0, 31]);
  });

  it('change their fingerprint only when what’s shown changes', () => {
    const a = eventSig(billEvent(bill)!);
    expect(eventSig(billEvent({ ...bill, remindDaysBefore: 7 })!)).toBe(a);
    expect(eventSig(billEvent({ ...bill, dueDate: '2026-11-02' })!)).not.toBe(a);
    expect(eventSig(billEvent({ ...bill, amountMinor: 7000 })!)).not.toBe(a);
  });
});
