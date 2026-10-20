import { describe, expect, it } from 'vitest';

import { buildEpc, buildSwissQr, decodePaymentCode, isQrIban, parseEpc, parseSwico, parseSwissQr, toMinor } from './payment-codes';

const SWISS = [
  'SPC', '0200', '1', 'CH4431999123000889012',
  'S', 'Robert Schneider AG', 'Rue du Lac', '1268', '2501', 'Biel', 'CH',
  '', '', '', '', '', '', '',
  '1949.75', 'CHF',
  'S', 'Pia-Maria Rutschmann-Schnyder', 'Grosse Marktgasse', '28', '9400', 'Rorschach', 'CH',
  'QRR', '210000000003139471430009017', 'Order from 15.10.2020', 'EPD',
  '//S1/10/10201409/11/200701/20/140.000-53/30/102673831/31/200615/32/7.7/33/7.7:2.60/40/0:30',
].join('\r\n');

const EPC = ['BCD', '002', '1', 'SCT', 'BFSWDE33BER', 'Wikimedia Foerdergesellschaft', 'DE33100205000001194700', 'EUR123.45', '', '', 'Spende fuer Wikipedia'].join('\n');

describe('toMinor', () => {
  it('converts decimal strings to minor units', () => {
    expect(toMinor('387.20')).toBe(38720);
    expect(toMinor('387.2')).toBe(38720);
    expect(toMinor('12')).toBe(1200);
    expect(toMinor('1,5')).toBe(150);
    expect(toMinor('abc')).toBeNull();
  });
});

describe('Swiss QR-bill', () => {
  it('reads payee, amount, account and reference', () => {
    const d = parseSwissQr(SWISS)!;
    expect(d.payee).toBe('Robert Schneider AG');
    expect(d.amountMinor).toBe(194975);
    expect(d.currency).toBe('CHF');
    expect(d.payment.iban).toBe('CH4431999123000889012');
    expect(d.payment.referenceType).toBe('QRR');
    expect(d.payment.reference).toBe('210000000003139471430009017');
    expect(d.payment.message).toBe('Order from 15.10.2020');
    expect(d.payment.raw).toBe(SWISS);
  });

  it('derives the due date from Swico payment conditions', () => {
    const d = parseSwissQr(SWISS)!;
    expect(d.issueDate).toBe('2020-07-01');
    expect(d.dueDate).toBe('2020-07-31');
  });

  it('leaves the amount open when the bill has none', () => {
    const noAmount = SWISS.replace('1949.75', '');
    expect(parseSwissQr(noAmount)!.amountMinor).toBeNull();
  });

  it('rejects non-QR-bill payloads', () => {
    expect(parseSwissQr('https://example.com')).toBeNull();
    expect(parseSwissQr(SWISS.replace('CH4431999123000889012', 'NOTANIBAN'))).toBeNull();
  });
});

describe('Swico bill information', () => {
  it('uses the 0% entry as the net period', () => {
    expect(parseSwico('//S1/11/261002/40/2:10;0:30')).toEqual({ issueDate: '2026-10-02', dueDate: '2026-11-01', discount: { percent: 2, until: '2026-10-12' } });
  });
  it('has no due date without conditions', () => {
    expect(parseSwico('//S1/11/261002')).toEqual({ issueDate: '2026-10-02', dueDate: null, discount: null });
  });
});

describe('EPC QR / GiroCode', () => {
  it('reads the transfer', () => {
    const d = parseEpc(EPC)!;
    expect(d.payee).toBe('Wikimedia Foerdergesellschaft');
    expect(d.amountMinor).toBe(12345);
    expect(d.currency).toBe('EUR');
    expect(d.country).toBe('DE');
    expect(d.payment.bic).toBe('BFSWDE33BER');
    expect(d.payment.reference).toBe('Spende fuer Wikipedia');
  });

  it('round-trips through buildEpc', () => {
    const built = buildEpc({ name: 'Stadtwerke', iban: 'DE33 1002 0500 0001 1947 00', amountMinor: 8990, reference: 'RF18 5390 0754 7034' })!;
    const d = parseEpc(built)!;
    expect(d.amountMinor).toBe(8990);
    expect(d.payment.iban).toBe('DE33100205000001194700');
    expect(d.payment.referenceType).toBe('SCOR');
    expect(d.payment.reference).toBe('RF18539007547034');
  });

  it('only builds for euros', () => {
    expect(buildEpc({ name: 'x', iban: 'CH4431999123000889012', currency: 'CHF' })).toBeNull();
  });
});

describe('decodePaymentCode', () => {
  it('picks the right standard', () => {
    expect(decodePaymentCode(SWISS)?.payment.standard).toBe('swiss_qr');
    expect(decodePaymentCode(EPC)?.payment.standard).toBe('epc');
    expect(decodePaymentCode('hello')).toBeNull();
  });
});

describe('buildSwissQr', () => {
  const address = { street: 'Rue du Lac', buildingNumber: '1268', postcode: '2501', town: 'Biel', country: 'CH' };

  it('round-trips a QR-IBAN bill with a QR reference', () => {
    expect(isQrIban('CH4431999123000889012')).toBe(true);
    const built = buildSwissQr({ iban: 'CH44 3199 9123 0008 8901 2', name: 'Robert Schneider AG', address, amountMinor: 194975, reference: '21 00000 00003 13947 14300 09017' })!;
    const d = parseSwissQr(built)!;
    expect(d.payee).toBe('Robert Schneider AG');
    expect(d.amountMinor).toBe(194975);
    expect(d.payment.referenceType).toBe('QRR');
    expect(d.payment.reference).toBe('210000000003139471430009017');
    expect(d.payment.creditorAddress?.town).toBe('Biel');
    expect(built.split('\r\n')).toHaveLength(31);
  });

  it('uses SCOR for creditor references and NON otherwise', () => {
    const iban = 'CH5800791123000889012'; // not a QR-IBAN
    expect(parseSwissQr(buildSwissQr({ iban, name: 'X', address, reference: 'RF18 5390 0754 7034' })!)!.payment.referenceType).toBe('SCOR');
    const non = parseSwissQr(buildSwissQr({ iban, name: 'X', address, reference: 'Invoice 4711' })!)!;
    expect(non.payment.referenceType).toBe('NON');
    expect(non.payment.message).toBe('Invoice 4711');
  });

  it('refuses incomplete details', () => {
    expect(buildSwissQr({ iban: 'CH4431999123000889012', name: 'X', address, reference: 'nope' })).toBeNull(); // QR-IBAN needs a QR reference
    expect(buildSwissQr({ iban: 'CH5800791123000889012', name: 'X', address: null })).toBeNull();
    expect(buildSwissQr({ iban: 'DE33100205000001194700', name: 'X', address })).toBeNull();
  });
});
