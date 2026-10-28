import { describe, expect, it } from 'vitest';

import { readShareLink, shareLink } from './bill-share';
import { emptyPayment, type Bill } from './types';

const SWISS_QR = [
  'SPC', '0200', '1', 'CH4431999123000889012', 'S', 'Elektrizitätswerk Zürich', 'Tramstrasse', '35', '8050', 'Zürich', 'CH',
  '', '', '', '', '', '', '', '184.50', 'CHF', '', '', '', '', '', '', '', 'QRR', '210000000003139471430009017', 'Strom Q3', 'EPD',
].join('\n');

const bill: Bill = {
  id: 'b1',
  payee: 'Elektrizitätswerk Zürich',
  description: 'Strom · Q3',
  amountMinor: 18450,
  currency: 'CHF',
  dueDate: '2026-11-30',
  issueDate: '2026-10-20',
  category: 'utilities',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: { ...emptyPayment(), standard: 'swiss_qr', raw: SWISS_QR, iban: 'CH4431999123000889012', reference: '210000000003139471430009017' },
  sources: { amount: 'qr' },
  status: 'open',
  paidAt: null,
  createdAt: '2026-10-21T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: '2026-11-27T08:00:00Z',
  reminderId: 'x',
  imageUri: 'file:///photo.jpg',
};

describe('sharing a bill', () => {
  it('round-trips what is needed to pay it, and nothing private', () => {
    const link = shareLink(bill);
    expect(link.startsWith('due://bill?d=')).toBe(true);
    expect(link).not.toContain('photo.jpg');
    const draft = readShareLink(`Pay this please: ${link}`, { remindDaysBefore: 5 })!;
    expect(draft).toMatchObject({ payee: bill.payee, description: bill.description, amountMinor: 18450, currency: 'CHF', dueDate: '2026-11-30', category: 'utilities', payMethod: 'qr_transfer', remindDaysBefore: 5, imageUri: null, sources: {} });
    expect(draft.payment.raw).toBe(bill.payment.raw);
    expect(draft.payment.reference).toBe(bill.payment.reference);
    // Read back from the code, not sent twice.
    expect(draft.payment.iban).toBe('CH4431999123000889012');
    expect(draft.payment.creditorName).toBe('Elektrizitätswerk Zürich');
    expect(link.length).toBeLessThan(700);
  });

  it('sends printed bank details when there is no code', () => {
    const plain = { ...bill, payment: { ...emptyPayment(), iban: 'DE89370400440532013000', reference: 'RE-2231' } };
    expect(readShareLink(shareLink(plain), { remindDaysBefore: 3 })!.payment).toMatchObject({ iban: 'DE89370400440532013000', reference: 'RE-2231', raw: null });
  });

  it('ignores anything that is not a due bill link', () => {
    expect(readShareLink('https://example.com', { remindDaysBefore: 3 })).toBeNull();
    expect(readShareLink('due://bill?d=%7Bbroken', { remindDaysBefore: 3 })).toBeNull();
    expect(readShareLink('due://bill?d=eyJ2IjoyfQ', { remindDaysBefore: 3 })).toBeNull(); // {"v":2}
  });
});
