import { describe, expect, it } from 'vitest';

import { currentMain, mainReminder, planDigest, planReminders, snoozeOptions, withinBudget } from './reminder-plan';
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

describe('currentMain', () => {
  const prefs = { remindHour: 9, extraNudges: true };
  it('follows a snooze, then the planned time, and does not re-plan one that went off', () => {
    expect(day(currentMain(bill({ snoozedUntil: new Date(2026, 9, 22, 9).toISOString() }), prefs, now)!)).toBe('10/22 9h');
    expect(day(currentMain(bill({ remindAt: new Date(2026, 9, 30, 9).toISOString() }), prefs, now)!)).toBe('10/30 9h');
    expect(currentMain(bill({ remindAt: new Date(2026, 9, 19, 9).toISOString() }), prefs, now)).toBeNull();
    expect(day(currentMain(bill(), prefs, now)!)).toBe('10/30 9h');
  });
  it('ignores a snooze that has passed', () => {
    expect(currentMain(bill({ snoozedUntil: new Date(2026, 9, 19, 9).toISOString(), remindAt: new Date(2026, 9, 19, 9).toISOString() }), prefs, now)).toBeNull();
  });
});

describe('withinBudget', () => {
  const r = (kind: 'main' | 'tomorrow' | 'overdue', d: number) => ({ kind, at: new Date(2026, 10, d, 9) });
  it('keeps everything under the cap', () => {
    expect(withinBudget([r('main', 3), r('main', 1)], 5).map((x) => x.at.getDate())).toEqual([1, 3]);
  });
  it('keeps the soonest, main reminders first', () => {
    const picked = withinBudget([r('main', 1), r('tomorrow', 2), r('overdue', 4), r('main', 3), r('main', 10), r('overdue', 11)], 3);
    expect(picked.map((x) => `${x.kind}${x.at.getDate()}`)).toEqual(['main1', 'main3', 'main10']);
    expect(withinBudget([r('main', 1), r('tomorrow', 2), r('main', 3), r('overdue', 12)], 3).map((x) => `${x.kind}${x.at.getDate()}`)).toEqual(['main1', 'tomorrow2', 'main3']);
  });
});

describe('snoozing', () => {
  const prefs = { remindHour: 9, extraNudges: true };
  it('silences every reminder until the snooze ends, then reminds once; later nudges stay', () => {
    // Due Wed 4 Nov: normally a reminder 30 Oct, a last call 3 Nov and an overdue nudge 5 Nov.
    const snoozed = bill({ snoozedUntil: new Date(2026, 10, 3, 9).toISOString() });
    expect(planReminders(snoozed, prefs, now).map((r) => [r.kind, day(r.at)])).toEqual([
      ['main', '11/3 9h'],
      ['overdue', '11/5 9h'],
    ]);
    const past = bill({ snoozedUntil: new Date(2026, 10, 10, 9).toISOString() });
    expect(planReminders(past, prefs, now).map((r) => [r.kind, day(r.at)])).toEqual([['main', '11/10 9h']]);
  });
});

describe('snoozeOptions', () => {
  const keys = (o: { key: string; at: Date; afterDue: boolean }[]) => o.map((x) => `${x.key} ${day(x.at)}${x.afterDue ? ' late' : ''}`);
  it('offers a day, 3 days, a week, two weeks and payday, marking those after the due date', () => {
    expect(keys(snoozeOptions(bill(), 9, '2026-10-25', now))).toEqual(['day1 10/21 9h', 'days3 10/23 9h', 'payday 10/25 9h', 'week1 10/27 9h', 'weeks2 11/3 9h']);
    expect(keys(snoozeOptions(bill({ dueDate: '2026-10-22' }), 9, null, now))).toEqual(['day1 10/21 9h', 'days3 10/23 9h late', 'week1 10/27 9h late', 'weeks2 11/3 9h late']);
  });
});
