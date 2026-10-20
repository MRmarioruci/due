import { daysBetween, todayIso } from './dates';
import type { Bill, Discount } from './types';

export type ActiveDiscount = Discount & { payMinor: number; savingMinor: number };

/** The bill's early-payment discount, if it's still on offer today, with what to pay and what it saves. */
export function activeDiscount(bill: Pick<Bill, 'discount' | 'amountMinor' | 'status'>, today = todayIso()): ActiveDiscount | null {
  const d = bill.discount;
  if (!d || bill.status === 'paid' || bill.amountMinor == null || daysBetween(today, d.until) < 0) return null;
  const savingMinor = Math.round((bill.amountMinor * d.percent) / 100);
  return { ...d, payMinor: bill.amountMinor - savingMinor, savingMinor };
}

/** The date reminders aim for: the discount deadline while it's on offer, else the due date. */
export function targetDate(bill: Pick<Bill, 'discount' | 'amountMinor' | 'status' | 'dueDate'>, today = todayIso()): string | null {
  return activeDiscount(bill, today)?.until ?? bill.dueDate;
}

/** Swaps the amount in a Swiss QR-bill payload, so the scanned code pays the discounted total. */
export function withSwissAmount(raw: string, minor: number): string {
  const sep = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(sep);
  if (lines[0] !== 'SPC' || lines.length < 20) return raw;
  lines[18] = (minor / 100).toFixed(2);
  return lines.join(sep);
}
