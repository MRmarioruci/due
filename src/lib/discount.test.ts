import { describe, expect, it } from 'vitest';

import { activeDiscount, targetDate, withSwissAmount } from './discount';
import { parseSwico, parseSwissQr } from './payment-codes';

const bill = { amountMinor: 38720, status: 'open' as const, dueDate: '2026-11-01', discount: { percent: 2, until: '2026-10-25' } };

describe('early-payment discounts', () => {
  it('reads the best discount from Swico terms', () => {
    expect(parseSwico('//S1/11/261002/40/2:10;3:5;0:30')).toEqual({
      issueDate: '2026-10-02',
      dueDate: '2026-11-01',
      discount: { percent: 3, until: '2026-10-07' },
    });
  });

  it('computes what to pay while the offer lasts', () => {
    expect(activeDiscount(bill, '2026-10-20')).toMatchObject({ percent: 2, savingMinor: 774, payMinor: 37946 });
    expect(activeDiscount(bill, '2026-10-25')).not.toBeNull();
    expect(activeDiscount(bill, '2026-10-26')).toBeNull();
    expect(activeDiscount({ ...bill, status: 'paid' }, '2026-10-20')).toBeNull();
  });

  it('aims reminders at the discount deadline, then the due date', () => {
    expect(targetDate(bill, '2026-10-20')).toBe('2026-10-25');
    expect(targetDate(bill, '2026-10-26')).toBe('2026-11-01');
  });

  it('rewrites the QR amount', () => {
    const raw = ['SPC', '0200', '1', 'CH4431999123000889012', 'S', 'Helsana', '', '', '8000', 'Zürich', 'CH', '', '', '', '', '', '', '', '387.20', 'CHF', '', '', '', '', '', '', '', 'NON', '', '', 'EPD'].join('\r\n');
    expect(parseSwissQr(withSwissAmount(raw, 37946))!.amountMinor).toBe(37946);
  });
});
