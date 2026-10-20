import { addDaysIso, todayIso } from './dates';
import { saveBill } from './store';
import { emptyPayment, type Bill, type Category } from './types';

/** Dev-only sample data so the list, bill and stats screens can be tried without scanning anything. */
export function seedSampleBills() {
  const today = todayIso();
  const mk = (payee: string, description: string, category: Category, minor: number, dueIn: number, paidDaysAgo?: number): Bill => ({
    id: `seed-${payee}-${dueIn}`,
    payee,
    description,
    amountMinor: minor,
    currency: 'CHF',
    dueDate: addDaysIso(today, dueIn),
    issueDate: addDaysIso(today, dueIn - 30),
    category,
    country: 'CH',
    payMethod: 'qr_transfer',
    payment: {
      ...emptyPayment(),
      standard: 'swiss_qr',
      iban: 'CH4431999123000889012',
      creditorName: payee,
      referenceType: 'QRR',
      reference: '210000000003139471430009017',
      raw: [
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
    mk('EWZ', 'Electricity', 'utilities', 13910, -52, 55),
    mk('Helsana', 'Health insurance', 'insurance', 38720, -48, 49),
    mk('Sunrise', 'Internet', 'telecom', 4980, -75, 77),
    mk('Helsana', 'Health insurance', 'insurance', 38720, -79, 81),
  ].forEach(saveBill);
}
