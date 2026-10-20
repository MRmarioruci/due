import { describe, expect, it } from 'vitest';

import { mainReminder, planDigest, planReminders } from './reminder-plan';
import { emptyPayment, type Bill } from './types';

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: 'h',
  payee: 'Helsana',
  description: null,
  amountMinor: 38720,
  currency: 'CHF',
  dueDate: '2026-11-04', // Wed
  issueDate: null,
  category: 'insurance',
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
  ...over,
});

const now = new Date(2026, 9, 20, 12); // Tue 20 Oct 2026
const day = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}h`;

describe('planReminders', () => {
  it('plans the main reminder, a last call and an overdue nudge', () => {
    const plan = planReminders(bill(), { remindHour: 9, extraNudges: true }, now);
    expect(plan.map((r) => [r.kind, day(r.at)])).toEqual([
      ['main', '10/30 9h'], // 3 days before is Sun 1 Nov -> Fri 30 Oct
      ['tomorrow', '11/3 9h'],
      ['overdue', '11/5 9h'],
    ]);
  });

  it('plans only the main reminder without extra nudges', () => {
    expect(planReminders(bill(), { remindHour: 8, extraNudges: false }, now).map((r) => r.kind)).toEqual(['main']);
  });

  it('skips the last call when it would land on the main reminder day', () => {
    const plan = planReminders(bill({ remindDaysBefore: 1 }), { remindHour: 9, extraNudges: true }, now);
    expect(plan.map((r) => r.kind)).toEqual(['main', 'overdue']);
  });

  it('plans nothing for paid bills', () => {
    expect(planReminders(bill({ status: 'paid' }), { remindHour: 9, extraNudges: true }, now)).toEqual([]);
  });
});

describe('planDigest', () => {
  it('summarises next Monday’s week', () => {
    const d = planDigest([bill(), bill({ id: 's', payee: 'Swisscom', amountMinor: 6490, dueDate: '2026-10-28' })], 9, now)!;
    expect(day(d.at)).toBe('10/26 9h');
    expect(d.title).toBe('This week: 1 bill, CHF 64.90');
  });

  it('is empty for a quiet week', () => {
    expect(planDigest([bill({ dueDate: '2026-12-01' })], 9, now)).toBeNull();
  });
});

describe('pay styles', () => {
  // Arrived Thu 15 Oct, due Wed 4 Nov; today is Tue 20 Oct, noon.
  const b = bill({ issueDate: '2026-10-15' });
  const prefs = { remindHour: 9, extraNudges: false };

  it('just in time: a few days before the due date', () => {
    expect(day(mainReminder({ ...b, payStyle: 'last' }, prefs, now)!)).toBe('10/30 9h');
  });
  it('right away: the next reminder slot', () => {
    expect(day(mainReminder({ ...b, payStyle: 'early' }, prefs, now)!)).toBe('10/21 9h');
  });
  it('halfway: between arrival and due date, weekends to Friday', () => {
    // 15 Oct + 10 days = Sun 25 Oct -> Fri 23 Oct
    expect(day(mainReminder({ ...b, payStyle: 'midway' }, prefs, now)!)).toBe('10/23 9h');
  });
  it('falls back to just in time when the style would be later', () => {
    const soon = bill({ issueDate: '2026-10-19', dueDate: '2026-10-22', payStyle: 'midway', remindDaysBefore: 1 });
    expect(day(mainReminder(soon, prefs, now)!)).toBe('10/21 9h');
  });
  it('uses the default style when the bill has none', () => {
    expect(day(mainReminder(b, { ...prefs, payStyle: 'early' }, now)!)).toBe('10/21 9h');
  });
});
