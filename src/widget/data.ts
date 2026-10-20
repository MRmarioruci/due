import { daysBetween, relativeDays } from '@/lib/dates';
import { activeDiscount, targetDate } from '@/lib/discount';
import { formatAmount } from '@/lib/money';
import type { Bill } from '@/lib/types';

export type WidgetData = {
  currency: string;
  total: string;
  count: number;
  next: { payee: string; amount: string; when: string; urgent: boolean } | null;
};

/** What the home-screen widget shows: the 30-day total and the next bill to deal with. */
export function widgetData(bills: Bill[], today: string): WidgetData {
  const open = bills.filter((b) => b.status === 'open');
  const counts = new Map<string, number>();
  open.forEach((b) => counts.set(b.currency, (counts.get(b.currency) ?? 0) + 1));
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'CHF';

  const pay = (b: Bill) => activeDiscount(b, today)?.payMinor ?? b.amountMinor ?? 0;
  const window = open.filter((b) => b.dueDate && daysBetween(today, b.dueDate) <= 30);
  const total = window.filter((b) => b.currency === currency).reduce((s, b) => s + pay(b), 0);

  const next = open
    .map((b) => ({ b, deadline: targetDate(b, today) }))
    .filter((x) => x.deadline)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];

  return {
    currency,
    total: formatAmount(total, currency),
    count: window.length,
    next: next
      ? {
          payee: next.b.payee,
          amount: `${next.b.currency} ${formatAmount(pay(next.b), next.b.currency)}`,
          when: relativeDays(next.deadline!, today),
          urgent: daysBetween(today, next.deadline!) <= 3,
        }
      : null,
  };
}
