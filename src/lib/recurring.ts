import { addDaysIso, daysBetween, fromIso, toIso } from './dates';
import type { Bill } from './types';

export type Cadence = 'monthly' | 'bimonthly' | 'quarterly' | 'halfyearly' | 'yearly';

const CADENCES: { cadence: Cadence; months: number; min: number; max: number; label: string }[] = [
  { cadence: 'monthly', months: 1, min: 25, max: 36, label: 'Monthly' },
  { cadence: 'bimonthly', months: 2, min: 55, max: 66, label: 'Every 2 months' },
  { cadence: 'quarterly', months: 3, min: 80, max: 105, label: 'Quarterly' },
  { cadence: 'halfyearly', months: 6, min: 165, max: 200, label: 'Twice a year' },
  { cadence: 'yearly', months: 12, min: 340, max: 390, label: 'Yearly' },
];

export const CADENCE_LABEL = Object.fromEntries(CADENCES.map((c) => [c.cadence, c.label])) as Record<Cadence, string>;

export type Series = {
  key: string;
  payee: string;
  cadence: Cadence;
  currency: string;
  /** The most recent bill's amount; what the next one is expected to be. */
  amountMinor: number;
  /** Normalised to one month, for "fixed costs per month". */
  monthlyMinor: number;
  lastDue: string;
  nextDue: string;
  /** When the next bill should have arrived, judging by how early previous ones came. */
  expectedArrival: string;
  /** True when the expected arrival is more than a week past and nothing came. */
  late: boolean;
};

/** Same biller, judged by name: lower-cased first word ("Helsana Versicherungen AG" and "Helsana" match). */
export function payeeKey(payee: string): string {
  return payee.trim().toLowerCase().split(/[\s,.-]+/)[0] ?? '';
}

function addMonthsIso(iso: string, months: number): string {
  const d = fromIso(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toIso(d);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Billers that bill on a regular rhythm, with their next expected bill. Needs at least two bills per biller. */
export function findSeries(bills: Bill[], today: string): Series[] {
  const groups = new Map<string, Bill[]>();
  for (const b of bills) {
    if (!b.dueDate || b.amountMinor == null) continue;
    const k = payeeKey(b.payee);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }

  const out: Series[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
    if (sorted.length < 2) continue;
    const gaps = sorted.slice(1).map((b, i) => daysBetween(sorted[i].dueDate!, b.dueDate!));
    const gap = median(gaps);
    const c = CADENCES.find((x) => gap >= x.min && gap <= x.max);
    if (!c) continue;

    const last = sorted[sorted.length - 1];
    const nextDue = addMonthsIso(last.dueDate!, c.months);
    // How early bills arrive: from the bill date, else from when it was scanned into due.
    const lead = Math.max(0, median(sorted.map((b) => daysBetween(b.issueDate ?? b.createdAt.slice(0, 10), b.dueDate!))));
    const expectedArrival = addDaysIso(nextDue, -lead);

    out.push({
      key,
      payee: last.payee,
      cadence: c.cadence,
      currency: last.currency,
      amountMinor: last.amountMinor!,
      monthlyMinor: Math.round(last.amountMinor! / c.months),
      lastDue: last.dueDate!,
      nextDue,
      expectedArrival,
      late: daysBetween(expectedArrival, today) > 7,
    });
  }
  return out.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/** The next bill of each series that hasn't arrived yet, within `horizon` days (late ones always). */
export function expectedBills(series: Series[], today: string, horizon = 45): Series[] {
  return series.filter((s) => s.late || daysBetween(today, s.nextDue) <= horizon);
}

/** Fixed costs per month in one currency. */
export function monthlyFixedCosts(series: Series[], currency: string): number {
  return series.filter((s) => s.currency === currency).reduce((sum, s) => sum + s.monthlyMinor, 0);
}
