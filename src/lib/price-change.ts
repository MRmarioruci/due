import { daysBetween } from './dates';
import { payeeKey } from './recurring';
import type { Bill } from './types';

export type PriceChange = {
  /** Change against the previous bill from the same biller, in percent (+6.4 = up). */
  pct: number;
  diffMinor: number;
  previousMinor: number;
  /** Due date (else saved date) of that previous bill, YYYY-MM-DD. */
  previousDate: string;
};

const dateOf = (b: Pick<Bill, 'dueDate' | 'createdAt'>) => b.dueDate ?? b.createdAt.slice(0, 10);

/**
 * How this bill's amount compares with the biller's previous one, or null when there is nothing to
 * compare, the change is under 1%, or either is a payment reminder (its fee would look like a price rise).
 */
export function priceChange(bill: Pick<Bill, 'id' | 'payee' | 'amountMinor' | 'currency' | 'dueDate' | 'createdAt' | 'dunning'>, bills: Bill[]): PriceChange | null {
  if (bill.amountMinor == null || bill.dunning) return null;
  const key = payeeKey(bill.payee);
  if (!key) return null;
  const at = dateOf(bill);
  const previous = bills
    .filter((b) => b.id !== bill.id && !b.dunning && b.amountMinor != null && b.currency === bill.currency && payeeKey(b.payee) === key && dateOf(b) < at)
    .sort((a, b) => dateOf(b).localeCompare(dateOf(a)))[0];
  if (!previous || daysBetween(dateOf(previous), at) > 400) return null;
  const prev = previous.amountMinor!;
  if (prev <= 0) return null;
  const pct = ((bill.amountMinor - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return null;
  return { pct: Math.round(pct * 10) / 10, diffMinor: bill.amountMinor - prev, previousMinor: prev, previousDate: dateOf(previous) };
}
