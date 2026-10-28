// A year of paid bills for the tax return or the accountant: a spreadsheet and a printable summary. Pure, so it can be tested.
// Receipts (everyday spending) are left out: this is the bills.

import { t } from '../i18n/core';
import { longDate } from './dates';
import { formatMoney } from './money';
import { isReceipt, type Bill, type Category } from './types';

/** What actually left the account: the discounted amount when a discount was taken. */
const paidOf = (b: Bill) => b.paidAmountMinor ?? b.amountMinor ?? 0;
const paidDay = (b: Bill) => b.paidAt!.slice(0, 10);

/** Years with at least one paid bill, newest first. */
export function paidYears(bills: Bill[]): number[] {
  return [...new Set(bills.filter((b) => b.status === 'paid' && b.paidAt && !isReceipt(b)).map((b) => Number(b.paidAt!.slice(0, 4))))].sort((a, b) => b - a);
}

/** Bills paid in the year (counted by the day they were paid, as for taxes), oldest first. */
export function paidIn(bills: Bill[], year: number): Bill[] {
  return bills.filter((b) => b.status === 'paid' && !isReceipt(b) && b.paidAt?.startsWith(String(year))).sort((a, b) => paidDay(a).localeCompare(paidDay(b)));
}

export type CategoryTotal = { category: Category; currency: string; minor: number; count: number };

/** Totals per category and currency, biggest first. */
export function totalsByCategory(bills: Bill[]): CategoryTotal[] {
  const m = new Map<string, CategoryTotal>();
  for (const b of bills) {
    const k = `${b.category}|${b.currency}`;
    const x = m.get(k) ?? { category: b.category, currency: b.currency, minor: 0, count: 0 };
    x.minor += paidOf(b);
    x.count += 1;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.minor - a.minor);
}

/**
 * Spreadsheet text. Excel in most European locales expects semicolons, so those are used unless the
 * language is English; the BOM makes Excel read the file as UTF-8 (umlauts, accents).
 */
export function taxCsv(bills: Bill[], opts: { categoryLabel: (c: Category) => string; semicolon: boolean }): string {
  const sep = opts.semicolon ? ';' : ',';
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = [t('tax.colPaid'), t('review.dueDate'), t('review.payee'), t('review.description'), t('review.category'), t('review.amount'), t('review.currency'), t('review.reference'), 'IBAN'];
  const rows = bills.map((b) => [
    paidDay(b),
    b.dueDate,
    b.payee,
    b.description,
    opts.categoryLabel(b.category),
    (paidOf(b) / 100).toFixed(2),
    b.currency,
    b.payment.reference,
    b.payment.iban,
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(sep)).join('\r\n') + '\r\n';
}

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A printable summary: totals per category, then every bill grouped by category. */
export function taxHtml(bills: Bill[], year: number, opts: { categoryLabel: (c: Category) => string; generatedOn: string }): string {
  const totals = totalsByCategory(bills);
  const sums = new Map<string, number>();
  bills.forEach((b) => sums.set(b.currency, (sums.get(b.currency) ?? 0) + paidOf(b)));
  const sections = [...new Set(totals.map((x) => x.category))]
    .map((c) => {
      const items = bills.filter((b) => b.category === c);
      return `<h2>${esc(opts.categoryLabel(c))}</h2><table>${items
        .map(
          (b) =>
            `<tr><td class="d">${esc(longDate(paidDay(b)))}</td><td>${esc(b.payee)}${b.description ? `<div class="s">${esc(b.description)}</div>` : ''}</td><td class="n">${esc(formatMoney(paidOf(b), b.currency))}</td></tr>`,
        )
        .join('')}</table>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { margin: 36px; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #0a0a0a; margin: 0; font-size: 12px; }
  .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
  .brand i { display: inline-block; width: 6px; height: 6px; background: #FF5A36; margin-left: 2px; }
  h1 { font-size: 26px; margin: 24px 0 4px; letter-spacing: -0.5px; }
  h2 { font-size: 11px; font-family: "Roboto Mono", Menlo, monospace; letter-spacing: 1px; text-transform: uppercase; color: #71717a; margin: 26px 0 6px; }
  .sub { color: #52525b; font-size: 13px; }
  .total { font-size: 30px; font-weight: 700; letter-spacing: -1px; margin: 14px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  td.d { width: 130px; color: #52525b; }
  td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .s { color: #71717a; font-size: 11px; margin-top: 2px; }
  .sum td { font-weight: 600; }
  .foot { margin-top: 28px; font-size: 10px; color: #a1a1aa; }
</style></head><body>
  <div class="brand">due<i></i></div>
  <h1>${esc(t('tax.title', { year }))}</h1>
  <div class="sub">${esc(t('tax.count', { n: bills.length }))}</div>
  ${[...sums].map(([ccy, minor]) => `<div class="total">${esc(formatMoney(minor, ccy))}</div>`).join('')}
  <h2>${esc(t('stats.byCategory'))}</h2>
  <table>${totals.map((x) => `<tr class="sum"><td>${esc(opts.categoryLabel(x.category))}</td><td class="n">${esc(formatMoney(x.minor, x.currency))}</td></tr>`).join('')}</table>
  ${sections}
  <div class="foot">${esc(t('pdf.generated', { date: opts.generatedOn }))}</div>
</body></html>`;
}
