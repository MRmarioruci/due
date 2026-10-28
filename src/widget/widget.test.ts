import { describe, expect, it } from 'vitest';

import { emptyPayment, type Bill } from '../lib/types';

import { widgetData } from './data';
import { dialSvg } from './dial-svg';

const bill = (id: string, dueDate: string, minor = 6490, status: Bill['status'] = 'open'): Bill => ({
  id,
  payee: id,
  description: null,
  amountMinor: minor,
  currency: 'CHF',
  dueDate,
  issueDate: null,
  category: 'other',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: emptyPayment(),
  sources: {},
  status,
  paidAt: null,
  createdAt: '2026-10-01T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
});

const today = '2026-10-27';

describe('widget', () => {
  it('draws the 30-day dial with a square per bill', () => {
    const svg = dialSvg([{ day: 3, size: 10, color: '#FF5A36' }, { day: 12, size: 8, color: '#ededed' }], '#ededed');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.match(/<line /g)).toHaveLength(32); // 31 day marks and today's
    expect(svg.match(/<rect /g)).toHaveLength(2);
    expect(svg).toContain('#FF5A36');
  });

  it('leads with the bill to deal with, lit on the dial', () => {
    const d = widgetData([bill('Swisscom', '2026-10-30'), bill('Helsana', '2026-11-08', 38720)], today);
    expect(d.centre).toMatchObject({ kind: 'focus', payee: 'Swisscom', amount: '64.90', currency: 'CHF', urgent: true });
    expect(d.dots.map((x) => [x.day, x.color])).toEqual([
      [3, '#FF5A36'],
      [12, '#5f5f5f'],
    ]);
  });

  it('says all handled when nothing is due this week', () => {
    const d = widgetData([bill('Helsana', '2026-11-08')], today);
    expect(d.centre).toMatchObject({ kind: 'calm', headline: 'All handled.' });
    expect(widgetData([], today).centre).toMatchObject({ kind: 'calm', headline: 'Nothing yet.', sub: null });
  });
});
