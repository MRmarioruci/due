import { describe, expect, it } from 'vitest';

import { billHtml } from './bill-html';
import { emptyPayment, type Bill } from './types';

const bill: Bill = {
  id: 'h',
  payee: 'Helsana <Versicherungen> & Co',
  description: 'Health insurance · November',
  amountMinor: 38720,
  currency: 'CHF',
  dueDate: '2026-11-01',
  issueDate: '2026-10-02',
  category: 'insurance',
  country: 'CH',
  payMethod: 'qr_transfer',
  payment: { ...emptyPayment(), iban: 'CH4431999123000889012', reference: '210000000003139471430009017' },
  sources: {},
  status: 'open',
  paidAt: null,
  createdAt: '2026-10-02T08:00:00Z',
  remindDaysBefore: 3,
  remindAt: null,
  reminderId: null,
  imageUri: null,
};

describe('billHtml', () => {
  const html = billHtml(bill, { qrPng: 'QRDATA', photoJpeg: null, category: 'Insurance', generatedOn: '21 October 2026' });

  it('has the payee (escaped), amount and payment details', () => {
    expect(html).toContain('Helsana &lt;Versicherungen&gt; &amp; Co');
    expect(html).not.toContain('<Versicherungen>');
    expect(html).toContain('387.20');
    expect(html).toContain('CH44 3199 9123 0008 8901 2');
    expect(html).toContain('210000000003139471430009017');
  });

  it('embeds the QR and skips the photo section without a photo', () => {
    expect(html).toContain('data:image/png;base64,QRDATA');
    expect(html).not.toContain('image/jpeg');
  });
});
