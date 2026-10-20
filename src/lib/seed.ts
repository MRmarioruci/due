import { addDaysIso, todayIso } from './dates';
import { homeCountry, homeCurrency } from './settings';
import { saveBill } from './store';
import { emptyPayment, type Bill, type Category } from './types';

/** Dev-only sample data so the list, bill and stats screens can be tried without scanning anything. */
export function seedSampleBills() {
  const today = todayIso();
  // Sample bills in your own currency; Swiss ones carry a real QR-bill payload, others a GiroCode-style IBAN.
  const currency = homeCurrency();
  const swiss = currency === 'CHF';
  const mk = (payee: string, description: string, category: Category, minor: number, dueIn: number, paidDaysAgo?: number, discountPct?: number): Bill => ({
    id: `seed-${payee}-${dueIn}`,
    payee,
    description,
    amountMinor: minor,
    currency,
    dueDate: addDaysIso(today, dueIn),
    issueDate: addDaysIso(today, dueIn - 30),
    discount: discountPct ? { percent: discountPct, until: addDaysIso(today, paidDaysAgo != null ? dueIn - 20 : 5) } : null,
    paidAmountMinor: discountPct && paidDaysAgo != null ? minor - Math.round((minor * discountPct) / 100) : null,
    category,
    country: swiss ? 'CH' : homeCountry(),
    payMethod: 'qr_transfer',
    payment: {
      ...emptyPayment(),
      standard: swiss ? 'swiss_qr' : null,
      iban: swiss ? 'CH4431999123000889012' : 'DE89370400440532013000',
      creditorName: payee,
      referenceType: swiss ? 'QRR' : null,
      reference: swiss ? '210000000003139471430009017' : `INV-${dueIn + 100}`,
      raw: !swiss ? null : [
        'SPC', '0200', '1', 'CH4431999123000889012', 'S', payee, 'Musterstrasse', '1', '8000', 'Zürich', 'CH',
        '', '', '', '', '', '', '', (minor / 100).toFixed(2), 'CHF',
        '', '', '', '', '', '', '', 'QRR', '210000000003139471430009017', description, 'EPD',
      ].join('\r\n'),
    },
    sources: { payee: 'qr', amount: 'qr', iban: 'qr', reference: 'qr', dueDate: 'ai' },
    status: paidDaysAgo != null ? 'paid' : 'open',
    paidAt: paidDaysAgo != null ? new Date(Date.now() - paidDaysAgo * 86_400_000).toISOString() : null,
    createdAt: new Date().toISOString(),
    remindDaysBefore: 3,
    remindAt: null,
    reminderId: null,
    imageUri: null,
  });

  [
    mk('Swisscom', 'Mobile', 'telecom', 6490, 3),
    mk('EWZ', 'Electricity', 'utilities', 14235, 8),
    mk('Helsana', 'Health insurance', 'insurance', 38720, 12),
    mk('Serafe', 'Radio & TV fee', 'fees', 33500, 21),
    mk('Sunrise', 'Internet', 'telecom', 4980, 27),
    mk('Helsana', 'Health insurance', 'insurance', 38720, -18, 20),
    mk('Swisscom', 'Mobile', 'telecom', 6490, -27, 29),
    mk('Steueramt', 'Tax instalment', 'taxes', 85000, -40, 42),
    mk('Elektro Meier', 'Repair invoice', 'housing', 42800, 25, undefined, 2),
    mk('Elektro Meier', 'Repair invoice', 'housing', 31600, -8, 25, 2),
    mk('EWZ', 'Electricity', 'utilities', 13910, -52, 55),
    mk('Helsana', 'Health insurance', 'insurance', 38720, -48, 49),
    mk('Sunrise', 'Internet', 'telecom', 4980, -75, 77),
    mk('Helsana', 'Health insurance', 'insurance', 38720, -79, 81),
  ].forEach(saveBill);
}
