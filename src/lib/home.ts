import { daysBetween } from './dates';
import type { Bill } from './types';

/** How far ahead the dial reaches, and what counts as "this week". */
export const DIAL_DAYS = 30;
export const WEEK = 7;

/**
 * What the home screen leads with: nothing saved yet, all handled (nothing due this week), or the
 * one bill to deal with now (the most overdue, else the soonest), with what follows it.
 */
export type HomeState =
  | { kind: 'empty' }
  | { kind: 'calm'; next: Bill | null }
  | { kind: 'focus'; focus: Bill; daysLeft: number; more: number; then: Bill | null };

const byDue = (a: Bill, b: Bill) => a.dueDate!.localeCompare(b.dueDate!);

export function homeState(bills: Bill[], today: string): HomeState {
  if (!bills.length) return { kind: 'empty' };
  const dated = bills.filter((b) => b.status === 'open' && b.dueDate).sort(byDue);
  const days = (b: Bill) => daysBetween(today, b.dueDate!);
  const urgent = dated.filter((b) => days(b) < WEEK);
  if (!urgent.length) return { kind: 'calm', next: dated[0] ?? null };
  const focus = urgent[0];
  return { kind: 'focus', focus, daysLeft: days(focus), more: urgent.length - 1, then: dated.find((b) => days(b) >= WEEK) ?? null };
}

/** Open bills on the dial: days from today (overdue ones sit on today), within DIAL_DAYS. */
export function dialPoints(bills: Bill[], today: string): { bill: Bill; day: number; overdue: boolean }[] {
  return bills
    .filter((b) => b.status === 'open' && b.dueDate)
    .map((bill) => {
      const d = daysBetween(today, bill.dueDate!);
      return { bill, day: Math.max(0, d), overdue: d < 0 };
    })
    .filter((p) => p.day <= DIAL_DAYS);
}
