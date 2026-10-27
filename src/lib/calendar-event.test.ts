import { describe, expect, it } from 'vitest';

import { allDayLocal, allDayUtc, billEvent, calendarLabel, defaultCalendar, eventSig, writableCalendars, type CalendarInfo } from './calendar-event';
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

describe('choosing a calendar', () => {
  const cal = (id: string, extra: Partial<CalendarInfo>): CalendarInfo => ({ id, title: id, allowsModifications: true, accessLevel: 'owner', source: { name: 'Phone', type: 'LOCAL' }, ...extra });
  const google = (id: string, extra: Partial<CalendarInfo> = {}) => cal(id, { source: { name: 'me@gmail.com', type: 'com.google' }, ...extra });

  it('prefers the Google account’s own calendar', () => {
    const all = [cal('phone', { isPrimary: true }), google('Holidays', { accessLevel: 'read', allowsModifications: false }), google('Team'), google('me@gmail.com', { ownerAccount: 'me@gmail.com' })];
    expect(defaultCalendar(all)?.id).toBe('me@gmail.com');
  });

  it('falls back to the phone’s primary calendar without a Google account', () => {
    expect(defaultCalendar([cal('a', {}), cal('b', { isPrimary: true })])?.id).toBe('b');
    expect(defaultCalendar([])).toBeNull();
  });

  it('leaves out read-only calendars and the old local "due" one', () => {
    const all = [google('Holidays', { accessLevel: 'read' }), cal('due', { name: 'due', ownerAccount: 'due' }), cal('phone', {}), google('mine')];
    expect(writableCalendars(all).map((c) => c.id)).toEqual(['mine', 'phone']);
    expect(calendarLabel(google('Personal'))).toBe('Personal · me@gmail.com');
  });
});
