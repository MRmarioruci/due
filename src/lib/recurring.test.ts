import { describe, expect, it } from 'vitest';

import { expectedBills, findSeries, monthlyFixedCosts, payeeKey, planMissingAlerts } from './recurring';
import { emptyPayment, type Bill } from './types';

const bill = (payee: string, minor: number, dueDate: string, issueDate: string | null = null): Bill => ({
  id: payee + dueDate,
  payee,
  description: null,
  amountMinor: minor,
  currency: 'CHF',
  dueDate,
  issueDate,
  category: 'other',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: emptyPayment(),
  sources: {},
  status: 'paid',
  paidAt: dueDate + 'T08:00:00Z',
  createdAt: dueDate + 'T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
});

describe('recurring bills', () => {
  it('matches billers by name', () => {
    expect(payeeKey('Helsana Versicherungen AG')).toBe(payeeKey('helsana'));
  });

  it('finds a monthly series and predicts the next bill', () => {
    const bills = [bill('Helsana', 38720, '2026-08-01'), bill('Helsana Versicherungen AG', 38720, '2026-09-01'), bill('Helsana', 39100, '2026-10-01')];
    const [s] = findSeries(bills, '2026-10-20');
    expect(s).toMatchObject({ cadence: 'monthly', amountMinor: 39100, nextDue: '2026-11-01', monthlyMinor: 39100, late: false });
  });

  it('spots yearly bills and normalises them per month', () => {
    const series = findSeries([bill('Serafe', 33500, '2025-11-10'), bill('Serafe', 33500, '2026-11-10')], '2026-10-20');
    expect(series[0].cadence).toBe('yearly');
    expect(monthlyFixedCosts(series, 'CHF')).toBe(2792);
  });

  it('flags a bill that should have arrived', () => {
    const bills = [bill('Swisscom', 6490, '2026-08-23', '2026-07-24'), bill('Swisscom', 6490, '2026-09-23', '2026-08-24')];
    const [s] = findSeries(bills, '2026-10-20'); // next due 23 Oct, should have arrived ~23 Sep
    expect(s.late).toBe(true);
    expect(expectedBills([s], '2026-10-20')).toHaveLength(1);
  });

  it('ignores one-offs and irregular billers', () => {
    expect(findSeries([bill('Elektro Meier', 42800, '2026-10-01')], '2026-10-20')).toEqual([]);
    expect(findSeries([bill('X', 1, '2026-01-01'), bill('X', 1, '2026-01-12')], '2026-10-20')).toEqual([]);
  });
});

describe('missing bills', () => {
  const monthly = [bill('Swisscom', 6500, '2026-08-30', '2026-08-05'), bill('Swisscom', 6500, '2026-09-30', '2026-09-05')];

  it('alert the morning a regular bill turns late', () => {
    const [s] = findSeries(monthly, '2026-10-01');
    expect(s.expectedArrival).toBe('2026-10-05');
    const [alert] = planMissingAlerts([s], 9, new Date(2026, 9, 1, 12));
    expect(alert.at).toEqual(new Date(2026, 9, 13, 9));
    // On that day findSeries calls it late too.
    expect(findSeries(monthly, '2026-10-13')[0].late).toBe(true);
    expect(findSeries(monthly, '2026-10-12')[0].late).toBe(false);
  });

  it('skip alerts whose moment has passed', () => {
    const [s] = findSeries(monthly, '2026-10-20');
    expect(planMissingAlerts([s], 9, new Date(2026, 9, 20, 12))).toEqual([]);
  });
});
