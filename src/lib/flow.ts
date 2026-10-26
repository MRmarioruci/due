import { fromIso } from './dates';
import { findSeries, payeeKey, type Cadence } from './recurring';
import type { Bill, Category } from './types';

/**
 * Where income goes: bills grouped by category, and what's left. The month view counts each
 * regular bill at its monthly share (a yearly fee is a twelfth of it) plus this month's one-off
 * bills; the year view counts what was due from January to today against that many months' income.
 */
export type FlowRow = { key: string; payee: string; minor: number; cadence: Cadence | null };
export type FlowGroup = { key: Category | 'other'; minor: number; rows: FlowRow[] };
export type Flow = { incomeMinor: number; billsMinor: number; leftMinor: number; groups: FlowGroup[] };

/** At most this many categories get their own stream; the rest share "everything else". */
const MAX_GROUPS = 3;
/** A category needs at least this share of the total to get its own stream. */
const MIN_SHARE = 0.05;

const amount = (b: Bill) => b.paidAmountMinor ?? b.amountMinor ?? 0;
const dateOf = (b: Bill) => b.dueDate ?? b.paidAt?.slice(0, 10) ?? b.createdAt.slice(0, 10);

export function monthFlow(bills: Bill[], incomeMonthlyMinor: number, currency: string, today: string): Flow {
  const mine = bills.filter((b) => b.currency === currency && b.amountMinor != null);
  const series = findSeries(mine, today).filter((s) => s.currency === currency);
  const regular = new Set(series.map((s) => s.key));
  const latest = (key: string) => mine.filter((b) => payeeKey(b.payee) === key).sort((a, b) => dateOf(b).localeCompare(dateOf(a)))[0];
  const rows: (FlowRow & { category: Category })[] = series.map((s) => ({ key: s.key, payee: s.payee, minor: s.monthlyMinor, cadence: s.cadence, category: latest(s.key)?.category ?? 'other' }));
  const month = today.slice(0, 7);
  for (const b of mine) {
    if (regular.has(payeeKey(b.payee)) || dateOf(b).slice(0, 7) !== month) continue;
    rows.push({ key: b.id, payee: b.payee, minor: amount(b), cadence: null, category: b.category });
  }
  return build(rows, incomeMonthlyMinor);
}

export function yearFlow(bills: Bill[], incomeMonthlyMinor: number, currency: string, today: string): Flow {
  const year = today.slice(0, 4);
  const byPayee = new Map<string, FlowRow & { category: Category }>();
  for (const b of bills) {
    const d = dateOf(b);
    if (b.currency !== currency || b.amountMinor == null || !d.startsWith(year) || d > today) continue;
    const key = payeeKey(b.payee) || b.id;
    const row = byPayee.get(key) ?? { key, payee: b.payee, minor: 0, cadence: null, category: b.category };
    row.minor += amount(b);
    byPayee.set(key, row);
  }
  const months = fromIso(today).getMonth() + 1;
  return build([...byPayee.values()], incomeMonthlyMinor * months);
}

function build(rows: (FlowRow & { category: Category })[], incomeMinor: number): Flow {
  const billsMinor = rows.reduce((s, r) => s + r.minor, 0);
  const base = Math.max(incomeMinor, billsMinor, 1);
  const cats = new Map<Category, FlowRow[]>();
  for (const { category, ...r } of rows) cats.set(category, [...(cats.get(category) ?? []), r]);
  const all = [...cats.entries()]
    .map(([key, rs]) => ({ key, rows: rs.sort((a, b) => b.minor - a.minor), minor: rs.reduce((s, r) => s + r.minor, 0) }))
    .sort((a, b) => b.minor - a.minor);
  const own = all.filter((g, i) => i < MAX_GROUPS && g.minor / base >= MIN_SHARE);
  const rest = all.filter((g) => !own.includes(g));
  const groups: FlowGroup[] = [...own];
  // One leftover category keeps its name; several share "everything else".
  if (rest.length === 1) groups.push(rest[0]);
  else if (rest.length > 1) {
    const rs = rest.flatMap((g) => g.rows).sort((a, b) => b.minor - a.minor);
    groups.push({ key: 'other', rows: rs, minor: rs.reduce((s, r) => s + r.minor, 0) });
  }
  return { incomeMinor, billsMinor, leftMinor: incomeMinor - billsMinor, groups };
}

