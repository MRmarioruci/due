import { daysBetween, fromIso, reminderMoment, toIso } from './dates';
import { payeeKey } from './recurring';

/**
 * A biller's contract: the day to review it by (to switch or cancel before it renews). Kept per biller,
 * not per bill, so it follows every bill from them.
 */
export type Contract = {
  /** The biller's name as shown, for notifications. */
  payee: string;
  /** YYYY-MM-DD. */
  reviewBy: string;
  /** Comes back every year (insurance, yearly renewals); otherwise it's done once the day passes. */
  yearly: boolean;
};

/** Contracts by payeeKey. */
export type Contracts = Record<string, Contract>;

/** Days before the review date that it shows on the home screen. */
export const REVIEW_WINDOW = 30;
/** Days before the review date that a reminder goes off. */
export const REVIEW_REMINDERS = [21, 7];

function addYearsIso(iso: string, years: number): string {
  const d = fromIso(iso);
  const day = d.getDate();
  d.setFullYear(d.getFullYear() + years);
  // 29 Feb in a year without one becomes 28 Feb.
  if (d.getDate() !== day) d.setDate(0);
  return toIso(d);
}

export function contractOf(payee: string, contracts: Contracts): Contract | null {
  const key = payeeKey(payee);
  return (key && contracts[key]) || null;
}

/** The next review day from today on: a yearly one rolls on to next year; a one-off that passed is null. */
export function nextReview(c: Contract, today: string): string | null {
  if (c.reviewBy >= today) return c.reviewBy;
  if (!c.yearly) return null;
  let years = 1;
  while (addYearsIso(c.reviewBy, years) < today) years++;
  return addYearsIso(c.reviewBy, years);
}

export type Review = { key: string; contract: Contract; date: string; daysLeft: number };

/** Contracts to review within the window, soonest first. */
export function dueForReview(contracts: Contracts, today: string, within = REVIEW_WINDOW): Review[] {
  return Object.entries(contracts)
    .map(([key, contract]) => {
      const date = nextReview(contract, today);
      return date ? { key, contract, date, daysLeft: daysBetween(today, date) } : null;
    })
    .filter((r): r is Review => r != null && r.daysLeft <= within)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** The review reminders still to come, at the usual reminder hour (weekends move to Friday). */
export function planReviewReminders(contracts: Contracts, hour: number, now = new Date()): (Review & { at: Date })[] {
  const today = toIso(now);
  return Object.entries(contracts).flatMap(([key, contract]) => {
    const date = nextReview(contract, today);
    if (!date) return [];
    return REVIEW_REMINDERS.flatMap((before) => {
      const at = reminderMoment(date, before, hour, now);
      return at ? [{ key, contract, date, daysLeft: daysBetween(toIso(at), date), at }] : [];
    });
  });
}
