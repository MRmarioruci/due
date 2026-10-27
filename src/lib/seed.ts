import { addDaysIso, daysBetween, todayIso } from './dates';
import { getSettings, homeCountry, homeCurrency, updateSettings } from './settings';
import { deleteBill, getBills, saveBill } from './store';
import { emptyPayment, type Bill, type Category } from './types';

/**
 * Sample data so every screen can be tried without scanning anything (Settings → Load sample bills):
 * a household in Zurich on CHF 8'000 a month after tax, with three months of paid bills behind it
 * and the next month's ahead. Also sets that income and the usual splits when there are none (or
 * only an older sample's), so "Where it goes" has something to show.
 */

/** Bills that come regularly: every `every` months on `day`, starting from a month where `month % every === phase`. */
type Regular = { payee: string; description: string; category: Category; minor: number; day: number; every: 1 | 3; phase?: number };
const REGULAR: Regular[] = [
  { payee: 'Livit AG', description: 'Rent · 3½ rooms', category: 'housing', minor: 178000, day: 1, every: 1 },
  { payee: 'Helsana', description: 'Health insurance', category: 'insurance', minor: 41230, day: 1, every: 1 },
  { payee: 'SBB', description: 'GA travelcard · monthly', category: 'transport', minor: 34000, day: 5, every: 1 },
  { payee: 'Holmes Place', description: 'Gym membership', category: 'health', minor: 11900, day: 10, every: 1 },
  { payee: 'Swisscom', description: 'Mobile', category: 'telecom', minor: 4990, day: 18, every: 1 },
  { payee: 'Sunrise', description: 'Internet & TV', category: 'telecom', minor: 5990, day: 22, every: 1 },
  { payee: 'EWZ', description: 'Electricity · quarter', category: 'utilities', minor: 18640, day: 20, every: 3, phase: 0 },
  { payee: 'Stadt Zürich', description: 'Water & waste water · quarter', category: 'utilities', minor: 9680, day: 26, every: 3, phase: 1 },
];

/** One-offs and yearly bills, by days from today (negative: in the past, so paid). */
type Single = { payee: string; description: string; category: Category; minor: number; dueIn: number; discountPct?: number };
const SINGLE: Single[] = [
  { payee: 'Serafe', description: 'Radio & TV fee · 2027', category: 'fees', minor: 33500, dueIn: 16 },
  { payee: 'Zahnarztpraxis Seefeld', description: 'Check-up & cleaning', category: 'health', minor: 28000, dueIn: 9 },
  { payee: 'Elektro Meier', description: 'Repair invoice', category: 'housing', minor: 42800, dueIn: 25, discountPct: 2 },
  { payee: 'Die Mobiliar', description: 'Household & liability insurance · year', category: 'insurance', minor: 31860, dueIn: -70 },
  { payee: 'Mobility', description: 'Car sharing · last month', category: 'transport', minor: 3850, dueIn: -12 },
  { payee: 'Galaxus', description: 'Vacuum cleaner', category: 'shopping', minor: 34900, dueIn: -33 },
];

const INCOME = 800000;
const SPLITS = [
  { id: 'seed-savings', name: 'Savings', monthlyMinor: 100000, kind: 'save' as const },
  { id: 'seed-3a', name: 'Pillar 3a', monthlyMinor: 60000, kind: 'save' as const },
  { id: 'seed-investing', name: 'Investing', monthlyMinor: 50000, kind: 'save' as const },
  { id: 'seed-groceries', name: 'Groceries', monthlyMinor: 90000, kind: 'spend' as const },
];

/** Months of history before this one, and how far ahead upcoming bills go. */
const HISTORY_MONTHS = 3;
const AHEAD_DAYS = 35;

const monthDay = (today: string, offset: number, day: number) => {
  const [y, m] = today.split('-').map(Number);
  const i = y * 12 + (m - 1) + offset;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** The sample bills for `today`: past ones paid a couple of days early, the next few weeks open. */
export function sampleBills(today: string, currency: string, country: string | null, now = Date.now()): Bill[] {
  const swiss = currency === 'CHF';
  const mk = (payee: string, description: string, category: Category, minor: number, dueDate: string, discountPct?: number): Bill => {
    const paid = dueDate < today;
    const paidOn = addDaysIso(dueDate, -2);
    const daysAgo = Math.max(0, daysBetween(paidOn, today));
    return {
      id: `seed-${payee.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dueDate}`,
      payee,
      description,
      amountMinor: minor,
      currency,
      dueDate,
      issueDate: addDaysIso(dueDate, -30),
      discount: discountPct ? { percent: discountPct, until: addDaysIso(today, 5) } : null,
      paidAmountMinor: null,
      category,
      country: swiss ? 'CH' : country,
      payMethod: 'qr_transfer',
      payment: {
        ...emptyPayment(),
        standard: swiss ? 'swiss_qr' : null,
        iban: swiss ? 'CH4431999123000889012' : 'DE89370400440532013000',
        creditorName: payee,
        referenceType: swiss ? 'QRR' : null,
        reference: swiss ? '210000000003139471430009017' : `INV-${dueDate.replace(/-/g, '')}`,
        raw: !swiss
          ? null
          : ['SPC', '0200', '1', 'CH4431999123000889012', 'S', payee, 'Musterstrasse', '1', '8000', 'Zürich', 'CH', '', '', '', '', '', '', '', (minor / 100).toFixed(2), 'CHF', '', '', '', '', '', '', '', 'QRR', '210000000003139471430009017', description, 'EPD'].join('\r\n'),
      },
      sources: { payee: 'qr', amount: 'qr', iban: 'qr', reference: 'qr', dueDate: 'ai' },
      status: paid ? 'paid' : 'open',
      paidAt: paid ? new Date(now - daysAgo * 86_400_000).toISOString() : null,
      createdAt: new Date(now - (paid ? daysAgo + 5 : 3) * 86_400_000).toISOString(),
      remindDaysBefore: 3,
      remindAt: null,
      reminderId: null,
      imageUri: null,
    };
  };

  const horizon = addDaysIso(today, AHEAD_DAYS);
  const bills: Bill[] = [];
  for (const r of REGULAR) {
    for (let k = -HISTORY_MONTHS; k <= 2; k++) {
      const due = monthDay(today, k, r.day);
      const month = Number(due.slice(5, 7)) - 1;
      if (r.every === 3 && month % 3 !== (r.phase ?? 0)) continue;
      if (due > horizon || due < monthDay(today, -HISTORY_MONTHS, 1)) continue;
      bills.push(mk(r.payee, r.description, r.category, r.minor, due));
    }
  }
  for (const s of SINGLE) bills.push(mk(s.payee, s.description, s.category, s.minor, addDaysIso(today, s.dueIn), s.discountPct));
  return bills;
}

/** An income or splits set by an earlier sample, which this one may replace. */
const OLD_SAMPLE_INCOME = 620000;

export function seedSampleBills() {
  // Loading again replaces the sample instead of piling it up; the user's own bills stay.
  for (const b of getBills()) if (b.id.startsWith('seed-')) deleteBill(b.id);
  sampleBills(todayIso(), homeCurrency(), homeCountry()).forEach(saveBill);

  const { income, splits } = getSettings();
  if (!income.length || (income.length === 1 && income[0].monthlyMinor === OLD_SAMPLE_INCOME)) updateSettings({ income: [{ label: null, monthlyMinor: INCOME }] });
  if (!splits.length || splits.every((s) => s.id.startsWith('seed-'))) updateSettings({ splits: SPLITS });
}
