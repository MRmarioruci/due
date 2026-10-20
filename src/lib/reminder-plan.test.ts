import { describe, expect, it } from 'vitest';

import { planDigest, planReminders } from './reminder-plan';
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
