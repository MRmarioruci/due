import type { Bill } from './types';

/** Something due stopped from being paid: a duplicate scan not saved, or a bill replaced by its payment reminder. */
export type KeptEvent = { kind: 'duplicate' | 'double'; minor: number; currency: string; at: string };

export type Kept = {
  totalMinor: number;
  discountsMinor: number;
  duplicates: { n: number; minor: number };
  doubles: { n: number; minor: number };
};

/** Money kept in `year` in one currency: discounts taken, plus duplicates and double payments avoided. */
export function moneyKept(bills: Bill[], events: KeptEvent[], year: number, currency: string): Kept {
  const inYear = (iso: string) => new Date(iso).getFullYear() === year;
  const discountsMinor = bills
    .filter((b) => b.status === 'paid' && b.paidAt && inYear(b.paidAt) && b.currency === currency && b.paidAmountMinor != null && b.amountMinor != null)
    .reduce((sum, b) => sum + Math.max(0, b.amountMinor! - b.paidAmountMinor!), 0);
  const sum = (kind: KeptEvent['kind']) => {
    const xs = events.filter((e) => e.kind === kind && e.currency === currency && inYear(e.at));
    return { n: xs.length, minor: xs.reduce((s, e) => s + e.minor, 0) };
  };
  const duplicates = sum('duplicate');
  const doubles = sum('double');
  return { totalMinor: discountsMinor + duplicates.minor + doubles.minor, discountsMinor, duplicates, doubles };
}
