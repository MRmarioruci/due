import { addDaysIso, daysBetween, fromIso, toIso } from './dates';
import { activeDiscount, targetDate } from './discount';
import type { Bill } from './types';

/** How often pay arrives. `weekday` is 1 = Monday … 7 = Sunday. */
export type PaySchedule =
  | { every: 'day' }
  | { every: 'week'; weekday: number }
  | { every: '2weeks'; next: string } // any one payday; the rest follow every 14 days
  | { every: 'month'; day: number };

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** "Every Friday", "25th of every month", … */
export function describePay(p: PaySchedule): string {
  switch (p.every) {
    case 'day':
      return 'Every day';
    case 'week':
      return `Every ${WEEKDAYS[p.weekday - 1]}`;
    case '2weeks':
      return `Every other ${WEEKDAYS[(fromIso(p.next).getDay() + 6) % 7]}`;
    case 'month':
      return `${ordinal(p.day)} of every month`;
  }
}

/**
 * The next payday after today. Monthly paydays past the end of a short month fall on its last day,
 * and monthly paydays on a weekend move to the Friday before, the way Swiss salaries are usually paid.
 */
export function nextPayday(p: PaySchedule, today: string): string {
  if (p.every === 'day') return addDaysIso(today, 1);
  if (p.every === 'week') {
    const dow = (fromIso(today).getDay() + 6) % 7; // 0 = Monday
    return addDaysIso(today, ((p.weekday - 1 - dow + 7) % 7) || 7);
  }
  if (p.every === '2weeks') {
    const gap = daysBetween(p.next, today);
    const ahead = 14 - (((gap % 14) + 14) % 14);
    return addDaysIso(today, ahead);
  }
  const t = fromIso(today);
  for (let m = 0; m < 3; m++) {
    const y = t.getFullYear();
    const month = t.getMonth() + m;
    const last = new Date(y, month + 1, 0).getDate();
    const d = new Date(y, month, Math.min(p.day, last));
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
export function planAroundPayday(bills: Bill[], payday: PaySchedule, currency: string, today: string): Plan {
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
export function paydayAdvice(bill: Bill, payday: PaySchedule, today: string): string | null {
  if (bill.status !== 'open') return null;
  const deadline = targetDate(bill, today);
  if (!deadline) return null;
  const day = nextPayday(payday, today);
  const when = fromIso(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return daysBetween(deadline, day) > 0
    ? `Due before payday (${when}), so it comes out of what's in the account now.`
    : `Due after payday (${when}). It can wait for your salary.`;
}
