import { daysBetween, toIso } from './dates';
import type { Bill, Category } from './types';
import { locale } from '../i18n/core';

export type Period = 'week' | 'month' | 'year';

export type Stats = {
  currency: string;
  buckets: { label: string; minor: number }[];
  onTime: number;
  paidCount: number;
  /** Average days paid before the due date, over bills with a due date in the current bucket. */
  avgDaysEarly: number | null;
  categories: { category: Category; minor: number }[];
};

/** What actually left the account: the discounted total when a discount was taken. */
const paidOf = (b: Bill) => b.paidAmountMinor ?? b.amountMinor ?? 0;

const COUNT: Record<Period, number> = { week: 8, month: 6, year: 4 };

function startOf(period: Period, d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  if (period === 'month') x.setDate(1);
  if (period === 'year') x.setMonth(0, 1);
  return x;
}

function shift(period: Period, d: Date, n: number): Date {
  const x = new Date(d);
  if (period === 'week') x.setDate(x.getDate() + 7 * n);
  if (period === 'month') x.setMonth(x.getMonth() + n);
  if (period === 'year') x.setFullYear(x.getFullYear() + n);
  return x;
}

function label(period: Period, d: Date): string {
  if (period === 'year') return String(d.getFullYear());
  if (period === 'month') return d.toLocaleDateString(locale(), { month: 'short' }).toUpperCase();
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'numeric' });
}

/** Paid bills bucketed by when they were paid. Only bills in the most common currency are summed. */
export function computeStats(bills: Bill[], period: Period, now = new Date(), fallbackCurrency = 'EUR'): Stats {
  const paid = bills.filter((b) => b.status === 'paid' && b.paidAt);
  const counts = new Map<string, number>();
  paid.forEach((b) => counts.set(b.currency, (counts.get(b.currency) ?? 0) + 1));
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallbackCurrency;

  const n = COUNT[period];
  const current = startOf(period, now);
  const starts = Array.from({ length: n }, (_, i) => shift(period, current, i - (n - 1)));
  const buckets = starts.map((s) => ({ label: label(period, s), minor: 0 }));
  const inCurrent: Bill[] = [];

  for (const b of paid) {
    const at = new Date(b.paidAt!);
    const idx = starts.findIndex((s, i) => at >= s && (i === n - 1 || at < starts[i + 1]));
    if (idx < 0) continue;
    if (b.currency === currency) buckets[idx].minor += paidOf(b);
    if (idx === n - 1) inCurrent.push(b);
  }

  const withDue = inCurrent.filter((b) => b.dueDate);
  const early = withDue.map((b) => daysBetween(toIso(new Date(b.paidAt!)), b.dueDate!));
  const cats = new Map<Category, number>();
  inCurrent.filter((b) => b.currency === currency).forEach((b) => cats.set(b.category, (cats.get(b.category) ?? 0) + paidOf(b)));

  return {
    currency,
    buckets,
    paidCount: inCurrent.length,
    onTime: early.filter((d) => d >= 0).length + (inCurrent.length - withDue.length),
    avgDaysEarly: early.length ? early.reduce((a, b) => a + b, 0) / early.length : null,
    categories: [...cats.entries()].map(([category, minor]) => ({ category, minor })).sort((a, b) => b.minor - a.minor),
  };
}
