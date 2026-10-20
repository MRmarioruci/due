import { addDaysIso, daysBetween, fromIso, toIso } from './dates';
import { activeDiscount, targetDate } from './discount';
import type { Bill } from './types';

/**
 * The next payday on or after tomorrow. Paydays past the end of a short month fall on its last day,
 * and weekend paydays move to the Friday before, the way Swiss salaries are usually paid.
 */
export function nextPayday(payday: number, today: string): string {
  const t = fromIso(today);
  for (let m = 0; m < 3; m++) {
    const y = t.getFullYear();
    const month = t.getMonth() + m;
    const last = new Date(y, month + 1, 0).getDate();
    const d = new Date(y, month, Math.min(payday, last));
    if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    if (d.getDay() === 0) d.setDate(d.getDate() - 2);
    const iso = toIso(d);
    if (daysBetween(today, iso) > 0) return iso;
  }
  return addDaysIso(today, 30);
}

export type Plan = {
  payday: string;
  /** Open bills whose deadline (discount or due date) comes before the next payday. */
  before: Bill[];
  after: Bill[];
  beforeMinor: number;
  afterMinor: number;
};

/** Splits open bills by whether they must be paid from what's in the account now or can wait for the salary. */
export function planAroundPayday(bills: Bill[], payday: number, currency: string, today: string): Plan {
  const day = nextPayday(payday, today);
  const open = bills.filter((b) => b.status === 'open');
  const deadline = (b: Bill) => targetDate(b, today);
  const before = open.filter((b) => {
    const d = deadline(b);
    return d != null && daysBetween(d, day) > 0;
  });
  const after = open.filter((b) => !before.includes(b) && deadline(b) != null);
  const sum = (xs: Bill[]) => xs.filter((b) => b.currency === currency).reduce((s, b) => s + (activeDiscount(b, today)?.payMinor ?? b.amountMinor ?? 0), 0);
  return { payday: day, before, after, beforeMinor: sum(before), afterMinor: sum(after) };
}

/** One line of advice for a single bill. */
export function paydayAdvice(bill: Bill, payday: number, today: string): string | null {
  if (bill.status !== 'open') return null;
  const deadline = targetDate(bill, today);
  if (!deadline) return null;
  const day = nextPayday(payday, today);
  const when = fromIso(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return daysBetween(deadline, day) > 0
    ? `Due before payday (${when}), so it comes out of what's in the account now.`
    : `Due after payday (${when}). It can wait for your salary.`;
}
