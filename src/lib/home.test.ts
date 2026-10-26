import { describe, expect, it } from 'vitest';

import { dialPoints, homeState } from './home';
import { emptyPayment, type Bill } from './types';

const bill = (id: string, dueDate: string | null, status: Bill['status'] = 'open'): Bill => ({
  id,
  payee: id,
  description: null,
  amountMinor: 1000,
  currency: 'CHF',
  dueDate,
  issueDate: null,
  category: 'other',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: emptyPayment(),
  sources: {},
  status,
  paidAt: status === 'paid' ? '2026-10-01T08:00:00Z' : null,
  createdAt: '2026-10-01T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
});

const today = '2026-10-20';

describe('home', () => {
  it('is empty before the first bill', () => {
    expect(homeState([], today)).toEqual({ kind: 'empty' });
  });

  it('is calm when nothing is due this week', () => {
    const s = homeState([bill('ewz', '2026-10-28'), bill('old', '2026-10-01', 'paid')], today);
    expect(s).toMatchObject({ kind: 'calm', next: { id: 'ewz' } });
    expect(homeState([bill('old', '2026-10-01', 'paid'), bill('nodate', null)], today)).toEqual({ kind: 'calm', next: null });
  });

  it('leads with the most overdue, then the soonest, and says what follows', () => {
    const bills = [bill('later', '2026-11-01'), bill('fri', '2026-10-23'), bill('late', '2026-10-18')];
    expect(homeState(bills, today)).toMatchObject({ kind: 'focus', focus: { id: 'late' }, daysLeft: -2, more: 1, then: { id: 'later' } });
    expect(homeState([bill('fri', '2026-10-23')], today)).toMatchObject({ focus: { id: 'fri' }, daysLeft: 3, more: 0, then: null });
  });

  it('puts open bills of the next 30 days on the dial, overdue ones on today', () => {
    const points = dialPoints([bill('late', '2026-10-18'), bill('in8', '2026-10-28'), bill('far', '2026-12-01'), bill('paid', '2026-10-22', 'paid')], today);
    expect(points.map((p) => [p.bill.id, p.day, p.overdue])).toEqual([
      ['late', 0, true],
      ['in8', 8, false],
    ]);
  });
});
